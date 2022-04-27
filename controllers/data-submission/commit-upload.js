const sql = require("mssql");
const { dropbox } = require("../../utility/Dropbox");
const {
  userReadAndWritePool,
} = require("../../dbHandlers/dbPools");
const awaitableEmailClient = require("../../utility/emailAuth");
const emailTemplates = require("../../utility/emailTemplates");
const base64url = require("base64-url");
let emailSubjectRoot = "CMAP Data Submission - ";

// Commit upload session (completing upload)
const commitUpload = async (req, res) => {
  let pool = await userReadAndWritePool;

  const { sessionID, dataSource, datasetLongName } = req.body;
  let fileName = req.body.fileName.trim();
  const offset = parseInt(req.body.offset);
  const currentTime = Date.now();

  let submissionType;

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
      submissionType = "Update";
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

        await dataSubmissionPhaseChange.query(
          dataSubmissionPhaseChangeQuery
        );
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
      console.log("Transaction failed");
      console.log(e);
      try {
        await transaction.rollback();
      } catch (err) {
        console.log("Rollback failed");
        console.log(err);
      }
      return res.sendStatus(500);
    }
  } catch (e) {
    console.log("Failed to commit dropbox upload");
    console.log(e);
    return res.sendStatus(500);
  }

  res.sendStatus(200);

  let emailClient = await awaitableEmailClient;

  let notifyAdminContent = emailTemplates.dataSubmissionAdminNotification(
    fileName,
    req.user,
    submissionType
  );

  let notifyAdminMessage =
    "From: 'me'\r\n" +
    "To: " +
    "cmap-data-submission@uw.edu" +
    "\r\n" +
    `Subject: ${
      submissionType === "New"
        ? emailSubjectRoot + fileName
        : "Re: " + emailSubjectRoot + fileName
    }\r\n` +
    "Content-Type: text/html; charset='UTF-8'\r\n" +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    notifyAdminContent;

  let rawAdminMessage = base64url.encode(notifyAdminMessage);

  try {
    await emailClient.users.messages.send({
      userId: "me",
      resource: {
        raw: rawAdminMessage,
      },
    });
  } catch (e) {
    console.log("Data submission notify admin failed:");
    console.log(e);
  }

  let notifyUserContent = emailTemplates.dataSubmissionUserNotification(
    fileName
  );
  let notifyUserMessage =
    "From: 'me'\r\n" +
    "To: " +
    req.user.email +
    "\r\n" +
    `Subject: ${
      submissionType === "New"
        ? emailSubjectRoot + fileName
        : "Re: " + emailSubjectRoot + fileName
    }\r\n` +
    "Content-Type: text/html; charset='UTF-8'\r\n" +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    notifyUserContent;

  let rawUserMessage = base64url.encode(notifyUserMessage);

  try {
    await emailClient.users.messages.send({
      userId: "me",
      resource: {
        raw: rawUserMessage,
      },
    });
  } catch (e) {
    console.log("Data submission notify user failed:");
    console.log(e);
  }
};

module.exports = commitUpload;
