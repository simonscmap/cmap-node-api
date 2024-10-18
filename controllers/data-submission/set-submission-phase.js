const sql = require("mssql");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");
const { sendServiceMail } = require("../../utility/email/sendMail");
const logInit = require("../../log-service");
const templates = require("../../utility/email/templates");
const Future = require("fluture");
const {
  CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
} = require("../../utility/constants");
const { subscribeUserToDataset } = require('../user/createSubscription')

const log = logInit("set-submission-phase");

const emailSubjectRoot = "CMAP Data Submission -";

let getPhaseSpecificQueryPart = (phaseId) => {
  switch (phaseId) {
    case 4:
      return `, QC2_Completion_Date_Time = GETDATE(), QC2_Completed_By = @userID`;
    case 5:
      return `, DOI_Accepted_Date_Time = GETDATE()`;
    case 6:
      return ", Ingestion_Date_Time = GETDATE()";
    case 7:
      return `, QC1_Completion_Date_Time = GETDATE(), QC1_Completed_By = @userID`;
    default:
      return "";
  }
};

let getQuery = (phaseId) => {
  let phaseSpecificQueryPart = getPhaseSpecificQueryPart(phaseId);
  return `
        UPDATE [tblData_Submissions]
        SET Phase_ID = @phaseID${phaseSpecificQueryPart}
        WHERE ID = @submissionID;

        SELECT [dbo].[tblData_Submissions].[Filename_Root],
        [dbo].[tblUsers].[Email],
        [dbo].[tblUsers].[FirstName],
        [dbo].[tblUsers].[FamilyName]
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblUsers] on [dbo].[tblData_Submissions].[Submitter_ID] = [dbo].[tblUsers].[UserID]
        WHERE ID = @submissionID
    `;
};

// Changes the current phase of a submission.
// Automatically sends relevant email to user
const setSubmissionPhase = async (req, res) => {
  let pool = await userReadAndWritePool;
  let request = new sql.Request(pool);

  // (1) Update Phase in Database

  let { phaseID, submissionID } = req.body;

  request.input("phaseID", sql.Int, phaseID);
  request.input("submissionID", sql.Int, submissionID);
  request.input("userID", sql.Int, req.user.id);

  let query = getQuery(phaseID);

  let result;

  try {
    result = await request.query(query);
  } catch (e) {
    log.error("failed to update phase id", { error: e, reqBody: req.body });
    return res.sendStatus(500);
  }

  res.sendStatus(200);

  // get info from submission record and request

  let record = result.recordset[0];

  let datasetName = record.Filename_Root;
  let email = record.Email;
  let userName = `${record.FirstName || ''}`;

  // (2) Notify User if Phase is 4 or 6

  if (phaseID === 4 || phaseID === 6) {
    let userNotificationContent;

    if (phaseID === 4) {
      userNotificationContent = templates.notifyUserAwaitingDOI({
        datasetName,
        addressee: userName,
      });
    } else if (phaseID === 6) {
      userNotificationContent = templates.notifyUserIngestionComplete({
        datasetName,
        addressee: userName,
      });

      // subscribe user to ingested dataset
      // result will be logged
      await subscribeUserToDataset (req.user.id, datasetName, log);
    }

    let mailArgs = {
      recipient: email,
      subject: `Re: ${emailSubjectRoot + datasetName}`,
      content: userNotificationContent,
    };

    let sendMailFuture = sendServiceMail (mailArgs);

    let reject = (e) => {
      log.error("failed to notify user of phase change", {
        recipient: mailArgs.recipient,
        error: e,
      });
    };

    let resolve = () => {
      log.info("email sent", {
        recipient: mailArgs.recipient,
        subject: mailArgs.subject,
      });
    };

    Future.fork (reject) (resolve) (sendMailFuture);
  }

  // (3) Notify Admin if Phase is 7

  if (phaseID === 7) {
    let content = templates.notifyAdminQC1Complete({
      datasetName,
      userName
    });

    let mailArgs = {
      recipient: CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
      subject: `${datasetName} Ready for QC2`,
      content,
    }

    let sendMailFuture = sendServiceMail (mailArgs);

    let reject = (e) => {
      log.error("failed to notify admin of QC1 Complete", {
        recipient: mailArgs.recipient,
        error: e,
      });
    };

    let resolve = () => {
      log.info("email sent", {
        recipient: mailArgs.recipient,
        subject: mailArgs.subject,
      });
    };

    Future.fork (reject) (resolve) (sendMailFuture);
  }
};

module.exports = setSubmissionPhase;
