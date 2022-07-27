const sql = require("mssql");
const { dropbox } = require("../../utility/Dropbox");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");
const { sendMail } = require("../../utility/email/sendMail");
const Future = require("fluture");
const templates = require("../../utility/email/templates");

const initializeLogger = require("../../log-service");
let log = initializeLogger("controllers/data-submission/commit-upload");
const {
  CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
} = require("../../utility/constants");

// Commit upload session (completing upload)
const commitUpload = async (req, res) => {
  let pool = await userReadAndWritePool;

  const { sessionID, dataSource, datasetLongName } = req.body;
  let fileName = req.body.fileName.trim();
  const offset = parseInt(req.body.offset);
  const currentTime = Date.now();

  let submissionType;

  // TODO we may want to refactor these 96 lies of the umbrella try/catch
  try {
    await dropbox.filesUploadSessionFinish({
      cursor: {
        session_id: sessionID,
        offset,
      },
      commit: {
        path: `/${fileName}/${fileName}_${currentTime}.xlsx`,
        mode: "add",
        autorename: true,
        mute: false,
      },
    });

    let checkFilenameRequest = new sql.Request(pool);
    let checkFilenameQuery = `
            SELECT ID, QC1_Completion_Date_Time FROM tblData_Submissions
            WHERE Filename_Root = '${fileName}'
        `;

    let checkFilenameResult = await checkFilenameRequest.query(
      checkFilenameQuery
    );

    var dataSubmissionID;
    var qc1WasCompleted;

    if (checkFilenameResult.recordset && checkFilenameResult.recordset.length) {
      dataSubmissionID = checkFilenameResult.recordset[0].ID;
      qc1WasCompleted = !!checkFilenameResult.recordset[0]
        .QC1_Completion_Date_Time;
      submissionType = "Updated";
    }

    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      if (dataSubmissionID === undefined) {
        submissionType = "New";
        const dataSubmissionsInsert = new sql.Request(transaction);
        dataSubmissionsInsert.input("filename", sql.NVarChar, fileName);
        dataSubmissionsInsert.input("dataSource", sql.NVarChar, dataSource);
        dataSubmissionsInsert.input(
          "datasetLongName",
          sql.NVarChar,
          datasetLongName
        );
        const dataSubmissionsInsertQuery = `
                INSERT INTO [dbo].[tblData_Submissions]
                (Filename_Root, Submitter_ID, Data_Source, Dataset_Long_Name)
                VALUES (@filename, ${req.user.id}, @dataSource, @datasetLongName)
                SELECT SCOPE_IDENTITY() AS ID
                `;

        const dataSubmissionsInsertQueryResult = await dataSubmissionsInsert.query(
          dataSubmissionsInsertQuery
        );
        dataSubmissionID = dataSubmissionsInsertQueryResult.recordset[0].ID;
      } else {
        let dataSubmissionPhaseChange = new sql.Request(transaction);
        dataSubmissionPhaseChange.input("filename", sql.NVarChar, fileName);
        let dataSubmissionPhaseChangeQuery = `
                    UPDATE [dbo].[tblData_Submissions]
                    SET Phase_ID = ${qc1WasCompleted ? 7 : 2}
                    WHERE Filename_Root = @filename
                `;

        await dataSubmissionPhaseChange.query(dataSubmissionPhaseChangeQuery);
      }

      dataSubmissionFilesInsert = new sql.Request(transaction);
      let dataSubmissionFilesInsertQuery = `
                INSERT INTO [dbo].[tblData_Submission_Files]
                (Submission_ID, Timestamp)
                VALUES (${dataSubmissionID}, ${currentTime})
            `;
      await dataSubmissionFilesInsert.query(dataSubmissionFilesInsertQuery);

      await transaction.commit();
    } catch (e) {
      log.error("transaction failed", e);
      try {
        await transaction.rollback();
      } catch (err) {
        log.error("rollback failed", err);
      }
      res.sendStatus(500);
      return;
    }
  } catch (e) {
    log.error("failed to commit dropbox upload", e);
    res.sendStatus(500);
    return;
  }

  res.sendStatus(200);

  // RESPONSE HAS BEEN SENT

  // NOTIFY ADMIN
  let subject =
    submissionType === "New"
      ? `CMAP Data Submission - ${fileName}`
      : `Re: CMAP Data Submission - ${fileName}`;

  let notifyAdminArgs = {
    subject,
    recipient: CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
    content: templates.notifyAdminOfDataSubmission({
      datasetName: fileName,
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
      fileName,
      user: req.user.id,
    });

  let sendNotifyAdmin = sendMail(notifyAdminArgs);

  Future.fork(rejectNotifyAdmin)(resolveNotifyAdmin)(sendNotifyAdmin);

  // NOTIFY USER
  let contentTemplate =
    submissionType === "New"
      ? templates.notifyUserOfReceiptOfNewDataSubmission
      : templates.notifyUserOfReceiptOfUpdatedDataSubmission;

  let notifyUserArgs = {
    subject,
    recipient: req.user.email,
    content: contentTemplate({
      datasetName: fileName,
      user: req.user,
    }),
  };

  let sendNotifyUser = sendMail(notifyUserArgs);

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

  Future.fork(rejectNotifyUser)(resolveNotifyUser)(sendNotifyUser);
};

module.exports = commitUpload;
