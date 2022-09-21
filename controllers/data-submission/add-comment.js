const sql = require("mssql");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");
const templates = require("../../utility/email/templates");
const { sendMail } = require("../../utility/email/sendMail");
const initializeLogger = require("../../log-service");
const {
  CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
} = require("../../utility/constants");
const Future = require("fluture");

let log = initializeLogger("controllers/data-submission/add-comment");

// check owner
// checks if user that sent comment is owner of dataset
// also fetches qality control status
const checkOwner = async (submissionId, userId) => {
  let userIsOwner = false;
  let qc1WasCompleted = false;

  let pool = await userReadAndWritePool;
  let checkOwnerRequest = new sql.Request(pool);

  checkOwnerRequest.input("ID", sql.Int, submissionId);

  let checkOwnerQuery = `
     SELECT Submitter_ID, QC1_Completion_Date_Time from tblData_Submissions
     WHERE ID = @ID
    `;

  // make request to fetch SubmitterID, based or submissionId

  let result;
  try {
    result = await checkOwnerRequest.query(checkOwnerQuery);
  } catch (e) {
    log.error("error requesting dataset owner information", e);
    throw new Error("error requesting dataset owner");
  }

  let owner = result.recordset[0].Submitter_ID;
  userIsOwner = owner === userId;
  qc1WasCompleted = !!result.recordset[0].QC1_Completion_Date_Time;

  if (!userIsOwner) {
    log.warn("mismatch between commenting user and dataset owner", {
      userId,
      ownerId: owner,
      submissionId,
    });
  }

  return [userIsOwner, qc1WasCompleted];
};

// insertCommentAndSelectUserInfo
const insertCommentAndSelectUserInfo = async (
  submissionID,
  comment,
  userId
) => {
  let pool = await userReadAndWritePool;
  let request = await new sql.Request(pool);
  request.input("ID", sql.Int, submissionID);
  request.input("comment", sql.VarChar, comment);

  let addCommentQuery = `
        INSERT INTO [dbo].[tblData_Submission_Comments]
        (Data_Submission_ID, Commenter_ID, Comment)
        VALUES (@ID, ${userId}, @comment)

        SELECT [dbo].[tblData_Submissions].[Filename_Root],
        [dbo].[tblData_Submissions].[Phase_ID],
        [dbo].[tblUsers].[Email],
        [dbo].[tblUsers].[FirstName]
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblUsers] on [dbo].[tblData_Submissions].[Submitter_ID] = UserID
        WHERE ID = @ID
    `;
  let result;
  try {
    result = await request.query(addCommentQuery);
  } catch (e) {
    log.error("error inserting comment and fetching dataset info");
    return null;
  }

  let datasetName = result.recordset[0].Filename_Root;
  let ownerEmail = result.recordset[0].Email;
  let ownerFirstName = result.recordset[0].FirstName;

  return {
    datasetName,
    ownerEmail,
    ownerFirstName,
  };
};

const sendNotificationToAdmin = async (
  datasetInfo,
  comment,
  userName,
  qc1WasCompleted
) => {
  let { datasetName } = datasetInfo;

  let content = templates.notifyAdminOfUserComment({
    datasetName,
    userMessage: comment,
    userName,
    // template already knows addressee is CMAP Admin
  });

  let pool = await userReadAndWritePool;
  let dataSubmissionPhaseChange = new sql.Request(pool);
  dataSubmissionPhaseChange.input("filename", sql.NVarChar, datasetName);

  let dataSubmissionPhaseChangeQuery = `
                UPDATE [dbo].[tblData_Submissions]
                SET Phase_ID = ${qc1WasCompleted ? 7 : 2}
                WHERE Filename_Root = @filename`;

  // error handling maybe ???
  await dataSubmissionPhaseChange.query(dataSubmissionPhaseChangeQuery);

  let emailSubject = `CMAP Data Submission - ${datasetName}`;


  let mailArgs = {
    recipient: CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
    subject: emailSubject,
    content,
  };

  let sendMailFuture = sendMail (mailArgs)

  let reject = (e) => {
    log.error("failed to notify admin of new comment", {
      recipient: mailArgs.recipient,
      error: e,
    });
  };

  let resolve = () => {
    log.info("email sent", { recipient: mailArgs.recipient, subject: mailArgs.subject });
  };

  Future.fork (reject) (resolve) (sendMailFuture);
};

const sendNotificationToUser = async (datasetInfo, comment, userName) => {
  let { datasetName, ownerFirstName, ownerEmail } = datasetInfo;

  let emailSubject = `CMAP Data Submission - ${datasetName}`;

  let mailContent = templates.notifyUserOfAdminComment({
    datasetName,
    userMessage: comment,
    userName, // admin name
    addressee: ownerFirstName,
  });

  let mailArgs = {
    recipient: ownerEmail,
    subject: emailSubject,
    content: mailContent,
  };

  let sendMailFuture = sendMail (mailArgs);

  let reject = (e) => {
    log.error("failed to notify user of new comment", {
      recipient: ownerEmail,
      error: e,
    });
  };

  let resolve = () => {
    log.info("email sent", { recipient: mailArgs.recipient, subject: mailArgs.subject });
  };

  Future.fork (reject) (resolve) (sendMailFuture);
};

// Add a timestamped comment to a submission

// 1. records comment in sql
// 2. sends mail to recipient

// Note: becuase both admin comments and user comments use the same route
// and route handler, we can't use the checkAdminAuth middleware, and
// and have to do it here; however, doing it here is odd, because the auth
// check doubles as a sort of user identification

// TODO separate these out into two routes, and protect the admin route with auth
const addCommentController = async (req, res) => {
  let { submissionID, comment } = req.body;
  log.trace("add comment controller -- start");
  // 1. check f request is from a user, make sure user is the owner of the data submission
  // being commented upon

  log.info("commenting user", { userId: req.user.id });

  let qc1WasCompleted = false;
  let userIsAdmin = req.user.isDataSubmissionAdmin;

  if (!userIsAdmin) {
    log.trace("check owner");
    let userIsOwner, qc1;
    try {
      [userIsOwner, qc1] = await checkOwner(submissionID, req.user.id);
    } catch (e) {
      log.error("error in checkOwner", e);
      res.sendStatus(500);
      return;
    }

    if (!userIsOwner) {
      res.sendStatus(401);
      return;
    }
    qc1WasCompleted = qc1;
  }

  // 2. insert comment in db and get dataset info

  log.trace("insert comment");
  let datasetInfo;
  try {
    datasetInfo = await insertCommentAndSelectUserInfo(
      submissionID,
      comment,
      req.user.id
    );
  } catch (e) {
    res.sendStatus(500);
    return;
  }

  // 3. fulfill web response

  log.trace("send web response 200");
  res.sendStatus(200);

  // 4. send appropriate notification
  // let userName = req.user.name;
  log.trace("send email");

  let { firstName, lastName } = req.user;
  let fullUserName = `${firstName} ${lastName}`;
  if (!req.user.isDataSubmissionAdmin) {
    await sendNotificationToAdmin(
      datasetInfo,
      comment,
      fullUserName,
      qc1WasCompleted
    );
  } else {
    // use admin's first name only
    await sendNotificationToUser(datasetInfo, comment, req.user.firstName);
  }

  // guess we're done :/
};

module.exports = addCommentController;
