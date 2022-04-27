const sql = require("mssql");
const {
  userReadAndWritePool,
} = require("../../dbHandlers/dbPools");
const awaitableEmailClient = require("../../utility/emailAuth");
const emailTemplates = require("../../utility/emailTemplates");
const base64url = require("base64-url");

// Changes the current phase of a submission. User by admin dashboard. Automatically sends relevant email to user
const setSubmissionPhase = async (req, res) => {
  let pool = await userReadAndWritePool;
  let request = await new sql.Request(pool);

  let { phaseID, submissionID } = req.body;

  request.input("phaseID", sql.Int, phaseID);
  request.input("submissionID", sql.Int, submissionID);

  let phaseSpecificQueryPart;

  switch (phaseID) {
    case 4:
      phaseSpecificQueryPart = `, QC2_Completion_Date_Time = GETDATE(), QC2_Completed_By = ${req.user.id}`;
      break;
    case 5:
      phaseSpecificQueryPart = `, DOI_Accepted_Date_Time = GETDATE()`;
      break;
    case 6:
      phaseSpecificQueryPart = ", Ingestion_Date_Time = GETDATE()";
      break;
    case 7:
      phaseSpecificQueryPart = `, QC1_Completion_Date_Time = GETDATE(), QC1_Completed_By = ${req.user.id}`;
      break;
    default:
      phaseSpecificQueryPart = "";
      break;
  }

  let query = `
        UPDATE [tblData_Submissions]
        SET Phase_ID = @phaseID${phaseSpecificQueryPart}
        WHERE ID = @submissionID;

        SELECT [dbo].[tblData_Submissions].[Filename_Root],
        [dbo].[tblUsers].[Email]
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblUsers] on [dbo].[tblData_Submissions].[Submitter_ID] = UserID
        WHERE ID = @submissionID
    `;

  try {
    let result = await request.query(query);
    res.sendStatus(200);

    let datasetName = result.recordset[0].Filename_Root;
    let email = result.recordset[0].Email;

    let emailClient = await awaitableEmailClient;
    let notificationContent;

    if (phaseID === 4 || phaseID === 6) {
      if (phaseID === 4) {
        notificationContent = emailTemplates.awaitingDOINotification(
          datasetName
        );
      } else if (phaseID === 6) {
        notificationContent = emailTemplates.ingestionCompleteNotification(
          datasetName
        );
      }

      let notification =
        "From: 'me'\r\n" +
        "To: " +
        email +
        "\r\n" +
        `Subject: Re: ${emailSubjectRoot + datasetName}\r\n` +
        "Content-Type: text/html; charset='UTF-8'\r\n" +
        "Content-Transfer-Encoding: base64\r\n\r\n" +
        notificationContent;

      let rawNotification = base64url.encode(notification);

      try {
        await emailClient.users.messages.send({
          userId: "me",
          resource: {
            raw: rawNotification,
          },
        });
      } catch (e) {
        console.log("Data submission notify admin failed:");
        console.log(e);
      }
    }

    if (phaseID === 7) {
      notificationContent = emailTemplates.qc1CompleteNotification(
        datasetName,
        req.user
      );

      let notification =
        "From: 'me'\r\n" +
        "To: cmap-data-submission@uw.edu\r\n" +
        `Subject: ${datasetName} Ready for QC2\r\n` +
        "Content-Type: text/html; charset='UTF-8'\r\n" +
        "Content-Transfer-Encoding: base64\r\n\r\n" +
        notificationContent;

      let rawNotification = base64url.encode(notification);

      try {
        await emailClient.users.messages.send({
          userId: "me",
          resource: {
            raw: rawNotification,
          },
        });
      } catch (e) {
        console.log("Data submission notify admin failed:");
      }
    }
  } catch (e) {
    console.log("Failed to update phase ID");
    console.log(e);
    return res.sendStatus(500);
  }
};

module.exports = setSubmissionPhase;
