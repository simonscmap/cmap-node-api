const sql = require("mssql");
const { dropbox } = require("../../utility/Dropbox");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");
const { sendServiceMail } = require("../../utility/email/sendMail");
const Future = require("fluture");
const templates = require("../../utility/email/templates");
const { safePath } = require("../../utility/objectUtils");

const initializeLogger = require("../../log-service");
let log = initializeLogger("controllers/data-submission/commit-upload");

const {
  CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
} = require("../../utility/constants");

// Commit upload session (completing upload)
const commitUpload = async (req, res) => {
  let pool = await userReadAndWritePool;

  const {
    submissionType,
    submissionId,
    dataSource,
    datasetLongName,
  } = req.body;

  let {
    shortName,
    sessionIds,
    offsets
  } = req.body;

  // based on whether we are uploading 1 file or 2, the formdata for offsets and sessionids
  // may be single values, or an array of values; for now we normalize them into an array
  if (Array.isArray (offsets)) {
    offsets = offsets.map (o => parseInt (o, 10));
  } else {
    offsets = [parseInt(offsets, 10)];
  }

  if (!Array.isArray (sessionIds)) {
    sessionIds = [sessionIds]
  }

  const currentTime = Date.now();

  log.info ('beginning dataset upload commit transaction', {
    currentTime,
    submissionType,
    submissionId,
    shortNameFromWorkbook: shortName,
  });

  // Basic Argument Checks

  if (submissionType === 'new' && (sessionIds.length !== 2 || offsets.length !== 2)) {
    log.error ('argument mismatch; expected new data submission to have 2 sessions & 2 file length', {
      submissionType,
      sessionIds,
      offsets,
    });
    res.status(400).send('Argument mismatch');
    return;
  }

  // 0. Check uniqueness of long name

  // 2. check long name
  let longNameIsAlreadyInUse = false;
  try {
    const checkLongNameRequest = await new sql.Request(pool);
    const longNameResponse = await checkLongNameRequest.query (`
      select ID from tblDatasets
      where Dataset_Long_Name = '${datasetLongName}'
    `);
    let id = safePath (['recordset', '0', 'ID']) (longNameResponse);
    if (id && id !== submissionId) {
      longNameIsAlreadyInUse = true
    }
  } catch (e) {
    log.error ('sql error', { e });
    return res.sendStatus (500);
  }

  if (longNameIsAlreadyInUse) {
     return res.status (409).send (`Dataset long name "${datasetLongName}" is already in use.`);
  }



  // 1. get submissionId, fileRoot, phase

  let fileNameRoot;

  if (submissionType === 'new') {
    fileNameRoot = shortName;
  }


  /* qc1WasCompleted is used to determine what phase
     to set the submission to (7 "awaiting QC2" or 2 "awaiting admin action") */
  let qc1WasCompleted;
  let nameChange = false;

  if (submissionType === 'update') {
    // get fileNameRoot from tblData_Submissions
    try {
      const getFilenameRequest = new sql.Request(pool);
      const query = `SELECT Filename_Root, QC1_Completion_Date_Time FROM tblData_Submissions
                   WHERE ID = '${submissionId}'`;

      const result = await getFilenameRequest.query(query);

      if (result.recordset.length !== 1) {
        res.status(500).send ('Error retrieving Filename_Root');
        return;
      }

      const Filename_Root = result.recordset[0].Filename_Root;

      if (Filename_Root !== shortName) {
        // mismatch between file name in database, and short name in workbook
        // nameChange = true;
        // TODO
        res.status(400).send ('Error: name change is not currently supported');
        return;
      } else {
        fileNameRoot = Filename_Root;
      }

      qc1WasCompleted = Boolean(result.recordset[0].QC1_Completion_Date_Time);

    } catch (e) {
      res.status(500).send ('Error administering upload status');
      return;
    }
  }

  // 1 (b) submission is "update" but shortName is different than name in tblData_Submissions
  // To update name:
  // - move folder in dropbox to new location
  // - update Filename_Root in tblData_Submissions
  if (nameChange) {
    console.log ('TODO: Name change');
  }

  // 2. call dropbox api
  const makeEntryArg = (session_id, offset, path) => ({
    cursor: {
      session_id,
      offset,
    },
    commit: {
      path,
      mode: 'add',
      autorename: false,
      mute: false,
    }
  });

  const filePath = `/${fileNameRoot}/${fileNameRoot}_${currentTime}.xlsx`;
  const rawFilePath = `/${fileNameRoot}/${fileNameRoot}_${currentTime}_raw_original.xlsx`;

  const entries = [
    makeEntryArg (sessionIds[0], offsets[0], filePath),
  ];

  if (submissionType === 'new' && sessionIds.length === 2 && offsets.length === 2) {
    entries.push (makeEntryArg (sessionIds[1], offsets[1], rawFilePath));
  }

  console.log ('dropbox args for filesUploadSessionFinishBatchV2', entries);

  try {
    /* await dropbox.filesUploadSessionFinish({
     *   cursor: {
     *     session_id: sessionID,
     *     offset,
     *   },
     *   commit: {
     *     path: `/${fileName}/${fileName}_${currentTime}.xlsx`,
     *     mode: "add",
     *     autorename: true,
     *     mute: false,
     *   },
     * }); */
    const response = await dropbox.filesUploadSessionFinishBatchV2({ entries });
    const { status, result } = response;
    if (status !== 200) {
      log.error ('unable to commit upload, received non-200 response from dropbox', { status });
      res.status(500).send (`Error: received ${status} response from dropbox`);
      return;
    }
    if (result && Array.isArray(result.entries)) {
      let allSucceeded = result.entries.every ((entry) => {
        console.log ('dbresp entry', entry);
        return entry['.tag'] === 'success';
      });
      if (!allSucceeded) {
        // TODO: do we need a rollback?
        log.debug ("dropbox resp", { response });
        throw new Error ('Error uploading files via batch api: not all results succeeded');
      }
    } else {
      throw new Error ('Error uploading files via batch api: unexpected result (no entries array)');
    }
  } catch (e) {
    log.error ('Error committing upload', { error: e });
    res.status(500).send ('Error committing upload to dropbox');
    return;
  }



  // 3. execute transaction
  const transaction = new sql.Transaction(pool);
  let dataSubmissionID = submissionId; // this is overwritted with the new id, if submissionType is "new"

  try {
    await transaction.begin();
    // 3 (a) CASE: New Submission
    if (submissionType === 'new') {
      const dataSubmissionsInsert = new sql.Request(transaction);
      dataSubmissionsInsert.input("filename", sql.NVarChar, fileNameRoot);
      dataSubmissionsInsert.input("dataSource", sql.NVarChar, dataSource);
      dataSubmissionsInsert.input("datasetLongName", sql.NVarChar, datasetLongName);

      // Add a new record in tblData_Submissions
      const dataSubmissionsInsertQuery = `
        INSERT INTO [dbo].[tblData_Submissions]
        (Filename_Root, Submitter_ID, Data_Source, Dataset_Long_Name)
        VALUES (@filename, ${req.user.id}, @dataSource, @datasetLongName)
        SELECT SCOPE_IDENTITY() AS ID`;

      const result = await dataSubmissionsInsert.query(
        dataSubmissionsInsertQuery
      );
      dataSubmissionID = safePath (['recordset', '0', 'ID']) (result);
    } else {
      // 3 (b) CASE: Update Submission
      let dataSubmissionPhaseChange = new sql.Request(transaction);
      dataSubmissionPhaseChange.input("filename", sql.NVarChar, fileNameRoot);
      // update record in tblData_Submissions
      let dataSubmissionPhaseChangeQuery = `
        UPDATE [dbo].[tblData_Submissions]
        SET Phase_ID = ${qc1WasCompleted ? 7 : 2}
        WHERE ID = ${submissionId}`;

      await dataSubmissionPhaseChange.query(dataSubmissionPhaseChangeQuery);
    }

    // 3 (c) update tblData_Submission_Files
    let dataSubmissionFilesInsert = new sql.Request(transaction);
    let dataSubmissionFilesInsertQuery = `
      INSERT INTO [dbo].[tblData_Submission_Files]
      (Submission_ID, Timestamp)
      VALUES (${dataSubmissionID}, ${currentTime})`;

    await dataSubmissionFilesInsert.query(dataSubmissionFilesInsertQuery);

    // 3 (d) commit database transaction
    await transaction.commit();
  } catch (e) {
    // 3 (e) rollback database transaction
    log.error("transaction failed", e);
    try {
      await transaction.rollback();
    } catch (err) {
      log.error("rollback failed", err);
    }
    res.status(500).send ('Error updating database with submission');
    return;
  }

  // if we're here' transaction was successful

  // 4. send response
  res.sendStatus(200);

  // RESPONSE HAS BEEN SENT

  // 5. notifiy admin (send email)
  let subject =
    submissionType === "New"
      ? `CMAP Data Submission - ${fileNameRoot}`
      : `Re: CMAP Data Submission - ${fileNameRoot}`;

  let notifyAdminArgs = {
    subject,
    recipient: CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
    content: templates.notifyAdminOfDataSubmission({
      datasetName: fileNameRoot,
      user: req.user,
      submissionType,
    }),
  };

  let rejectNotifyAdmin = (e) => {
    log.error("failed to notify admin of new data submission", {
      subject,
      error: e,
    });
  };

  let resolveNotifyAdmin = () =>
    log.info("notified admin of new data submission", {
      fileNameRoot,
      user: req.user.id,
    });

  let sendNotifyAdmin = sendServiceMail (notifyAdminArgs);

  Future.fork (rejectNotifyAdmin) (resolveNotifyAdmin) (sendNotifyAdmin);

  // 6. notify user
  let contentTemplate =
    submissionType === "New"
      ? templates.notifyUserOfReceiptOfNewDataSubmission
      : templates.notifyUserOfReceiptOfUpdatedDataSubmission;

  let notifyUserArgs = {
    subject,
    recipient: req.user.email,
    content: contentTemplate({
      datasetName: fileNameRoot,
      user: req.user,
    }),
  };

  let sendNotifyUser = sendServiceMail (notifyUserArgs);

  let rejectNotifyUser = (e) => {
    log.error(
      `failed to notify user of receipt of ${
        submissionType === "New" ? "new" : "updated"
      } data submission`,
      {
        subject,
        recipientId: req.user.id,
        error: e,
      }
    );
  };

  let resolveNotifyUser = () =>
    log.info("notified user of receipt of data submission", { subject });

  Future.fork (rejectNotifyUser) (resolveNotifyUser) (sendNotifyUser);
};

module.exports = commitUpload;
