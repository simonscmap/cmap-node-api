const sql = require("mssql");
const { dropbox } = require("../../utility/Dropbox");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");
const { sendServiceMail } = require("../../utility/email/sendMail");
const Future = require("fluture");
const templates = require("../../utility/email/templates");
const { safePath } = require("../../utility/objectUtils");
const { checkLongName, checkShortName } = require('./check-name');
const {
  createTempFolder,
  copyFiles,
  renameFolder,
  deleteFolder,
} = require('./change-submission-name');

const initializeLogger = require("../../log-service");
let moduleLogger = initializeLogger("controllers/data-submission/commit-upload");

const {
  CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
} = require("../../utility/constants");

// Commit upload session (completing upload)
const commitUpload = async (req, res) => {
  const { id: userId, reqId } = req.user;
  const log = moduleLogger.setReqId (reqId);
  let pool = await userReadAndWritePool;

  const {
    submissionType,
    dataSource,
    datasetLongName,
  } = req.body;

  let {
    submissionId, // id of submission to update
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

  // submissionID is submitted as a string and needs to be converted to int
  submissionId = parseInt (submissionId, 10);

  const currentTime = Date.now();

  log.info ('beginning dataset upload commit transaction', {
    currentTime,
    submissionType,
    submissionId, // id of submission to update
    shortNameFromWorkbook: shortName,
    sessionIds,
    offsets
  });

  // Basic Argument Checks

  if (!shortName) {
    log.info ('Bad request: insufficient args to commit upload: no shortName', { shortName });
    res.status(400).send('Bad request: missing shortName');
    return;
  }

  if (submissionType === 'new' && (sessionIds.length !== 2 || offsets.length !== 2)) {
    log.error ('argument mismatch; expected new data submission to have 2 sessions & 2 file length', {
      submissionType,
      sessionIds,
      offsets,
    });
    res.status(400).send('Bad request: argument mismatch');
    return;
  }

  // 0. Check uniqueness of long name

  let longNameConflict = false;
  const [lnError, result] = await checkLongName (datasetLongName, userId, submissionId);
  if (lnError) {
    return res.status(500).send ('Error while checking long name');
  } else {
    longNameConflict = result.longNameUpdateConflict || result.longNameIsAlreadyInUse;
  }

  if (longNameConflict) {
    res.status (409).send (`Conflict: Dataset long name "${datasetLongName}" is already in use.`);
    return;
  }

  // 1. get submissionId, fileRoot, phase

  let fileNameRoot, changeLongName;

  if (submissionType === 'new') {
    fileNameRoot = shortName;
  }

  let qc1WasCompleted;
  if (submissionType === 'update') {
    // get fileNameRoot from tblData_Submissions
    try {
      const getFilenameRequest = new sql.Request(pool);
      const query = `
        SELECT Filename_Root, QC1_Completion_Date_Time, Dataset_Long_Name
        FROM tblData_Submissions
        WHERE ID = '${submissionId}'`;

      let result;
      try {
        result = await getFilenameRequest.query(query);
      } catch (e) {
        log.error ('Error retrieving filename for submission', { error: e });
      }

      const Filename_Root = safePath (['recordset', '0', 'Filename_Root']) (result);
      const Dataset_Long_Name = safePath (['recordset', '0', 'Dataset_Long_Name']) (result);


      if (result.recordset.length !== 1 || !Filename_Root) {
        res.status(500).send ('Error retrieving Filename_Root');
        return;
      }

      // set the name to use for the update
      fileNameRoot = Filename_Root;

      qc1WasCompleted = Boolean(result.recordset[0].QC1_Completion_Date_Time);

      // indicate long name should be updated
      if (Dataset_Long_Name !== datasetLongName) {
        changeLongName = true;
      }
    } catch (e) {
      res.status(500).send ('Error administering upload status');
      return;
    }
  }

  // 1 (b) submission is "update" but shortName is different than name in tblData_Submissions
  let nameChange = false;
  if (submissionType === 'update' && fileNameRoot !== shortName) {
    log.info ('submision is update with name change', { fileNameRoot, newShortName: shortName });
    nameChange = true;
  }

  // 1 (c) short name check
  if (nameChange) {
    try {
      let [error, shortNameCheckResult] = await checkShortName (shortName, userId, submissionId);
      if (error || !shortNameCheckResult) {
        log.error ('Error confirming short name is available', { error, shortName, userId, submissionId });
        return res.status(500).send ('Error confirming that new short name is available')
      }
      const {
        shortNameIsAlreadyInUse,
        shortNameUpdateConflict,
        // folderExists,
      } = shortNameCheckResult;

      if (shortNameIsAlreadyInUse || shortNameUpdateConflict) {
        log.info('Preventing data submission update: short name is not available', { shortName, userId, submissionId, ...shortNameCheckResult });
        return res.status(409).send ('Short name is not available');
      }
    } catch (e) {
      log.error ('Error confirming short name is available', { error: e, shortName, userId, submissionId });
      return res.status(500).sed ('Error');
    }
  }

  // 1 (d) create temp folder

  let tmpFolder;
  if (nameChange) {
    // create temp folder based on current name
    const [tfErr, tfResult] = await createTempFolder (fileNameRoot);
    if (tfErr) {
      log.error ('error creating temp folder for short name change', tfErr);
      return res.status(500).send('Error uploading file (#1)');
    }
    tmpFolder = tfResult.folderName;
  }

  // 2. call dropbox api: filesUploadSessionFinishBatchV2
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

  const fileNameBase = nameChange ? shortName : fileNameRoot;

  const filePath = `${tmpFolder || '/' + fileNameRoot}/${fileNameBase}_${currentTime}.xlsx`;
  const rawFilePath = `${tmpFolder || '/' + fileNameRoot}/${fileNameBase}_${currentTime}_raw_original.xlsx`;

  const entries = [
    makeEntryArg (sessionIds[0], offsets[0], filePath),
  ];

  if (submissionType === 'new' && sessionIds.length === 2 && offsets.length === 2) {
    entries.push (makeEntryArg (sessionIds[1], offsets[1], rawFilePath));
  }

  try {
    const response = await dropbox.filesUploadSessionFinishBatchV2({ entries });
    const { status, result } = response;
    if (status !== 200) {
      log.error ('unable to commit upload, received non-200 response from dropbox', { status, entries });
      res.status(500).send (`Error comitting upload (#2a)`);
      return;
    }
    if (result && Array.isArray(result.entries)) {
      let allSucceeded = result.entries.every ((entry) => {
        return entry['.tag'] === 'success';
      });
      if (!allSucceeded) {
        log.error ("dropbox batch upload not successful", { response });
        res.status(500).send ('Error committing upload (#2b)');
        if (tmpFolder) {
          await deleteFolder (tmpFolder);
        }
        return;
      }
    } else {
      log.error ("unexpected result uploading files via batch apy", { response });
      res.status(500).send ('Error committing upload (#2c)');
      if (tmpFolder) {
          await deleteFolder (tmpFolder);
        }
      return;
    }
  } catch (e) {
    log.error ('Error committing upload', { error: e });
    res.status(500).send ('Error committing upload (#2d)');
    if (tmpFolder) {
       await deleteFolder (tmpFolder);
    }
    return;
  }


  // if name change, continue with name-change steps
  // 2 (b) copy files from existing submission to new tmp folder
  let copySuccess = false;
  if (nameChange) {
    // copy files from prev folder
    const arg = {
      prevPath: `/${fileNameRoot}`,
      newPath: tmpFolder,
    };
    const [cpErr, cpResult] = await copyFiles(arg);
    console.log (cpErr && cpErr.error);

    if (cpErr) {
      log.error ('error copying files to temp folder', { ...arg, error: cpErr });
      res.status(500).send ('Error comitting upload (#2e)');
      // cleanup tmp folder
      await deleteFolder (tmpFolder);
      return;
    }
    log.debug ('copy files result', cpResult);
    copySuccess = true;
  }

  // 2 (c) rename temp folder
  let renameSuccess = false;
  const newFolderPath = `/${shortName}`;
  if (nameChange) {
    if (tmpFolder && copySuccess) {
      // rename temp dir
      const arg = {
        prevPath:  tmpFolder,
        newPath: newFolderPath,
      };
      const [rnErr, rnResult] = await renameFolder (arg);
      if (rnErr) {
        log.error ('error renaming tmp folder', arg);
        res.status(500).send('Error uploading file (#2f)');
        return;
      } else {
        log.debug ('rename folder success', rnResult);
      }
      renameSuccess = true;
    } else {
      log.error ('name change requested, but some steps failed', {
        nameChange,
        tmpFolder,
        copySuccess,
        fileNameRoot,
        shortName,
      });
      await deleteFolder (tmpFolder);
      res.status (500). send ('Error uploading file (#2g)');
      return;
    }
  }

  // 3. execute transaction with sql database
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
      // 3 (b) CASE: Update Submission (also handles shortName change)
      let dataSubmissionPhaseChange = new sql.Request(transaction);
      const newPhase = qc1WasCompleted ? 7 : 2;
      dataSubmissionPhaseChange.input("newPhase", sql.Int, newPhase);
      let changeNameDirective = '';
      if (nameChange && tmpFolder && copySuccess && renameSuccess) {
        log.info ('preparing to commit name change with submission update', { fileNameRoot, shortName });
        dataSubmissionPhaseChange.input("updatedShortName", sql.NVarChar, shortName);
        changeNameDirective = `, Filename_Root = @updatedShortName`;
      }
      let changeLongNameDirective = '';
      // TODO change long name
      if (changeLongName) {
        log.info ('preparing to change long name', { newLongName: datasetLongName });
        dataSubmissionPhaseChange.input("newLongName", sql.NVarChar, datasetLongName);
        changeLongNameDirective = `, Dataset_Long_Name = @newLongName`;
      }
      // update record in tblData_Submissions
      let dataSubmissionPhaseChangeQuery = `
        UPDATE [dbo].[tblData_Submissions]
        SET Phase_ID = @newPhase
            ${changeNameDirective}
            ${changeLongNameDirective}
        WHERE ID = ${submissionId}`;

      log.debug ('update query', dataSubmissionPhaseChangeQuery);

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
    // cleanup new dropbox folder (either the temp folder or the renamed folder)
    if (nameChange) {
      if (renameFolder) {
        await deleteFolder (newFolderPath);
      } else if (tmpFolder) {
        await deleteFolder (tmpFolder);
      }
    }
    res.status(500).send ('Error updating database with submission');
    return;
  }


  if (nameChange) {
    // delete old folder
    log.debug ('name change successufl; deleting old submission folder', { fileNameRoot });
    await deleteFolder (`/${fileNameRoot}`);
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
