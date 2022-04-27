// Add a timestamped comment to a submission
// 1. records comment in sql
// 2. sends mail to recipient

const addComment = async (req, res) => {
  let pool = await userReadAndWritePool;
  let request = await new sql.Request(pool);

  let { submissionID, comment } = req.body;
  let qc1WasCompleted = false;

  //TODO make this check a re-usable function / middleware
  if (!req.user.isDataSubmissionAdmin) {
    try {
      let checkOwnerRequest = new sql.Request(pool);
      checkOwnerRequest.input("ID", sql.Int, submissionID);

      let checkOwnerQuery = `
                SELECT Submitter_ID, QC1_Completion_Date_Time from tblData_Submissions
                WHERE ID = @ID
            `;

      let checkOwnerResult = await checkOwnerRequest.query(checkOwnerQuery);
      let owner = checkOwnerResult.recordset[0].Submitter_ID;
      qc1WasCompleted = !!checkOwnerResult.recordset[0]
        .QC1_Completion_Date_Time;

      if (req.user.id !== owner) {
        return res.sendStatus(401);
      }
    } catch (e) {
      console.log(e);
      return res.sendStatus(500);
    }
  }

  request.input("ID", sql.Int, submissionID);
  request.input("comment", sql.VarChar, comment);

  let addCommentQuery = `
        INSERT INTO [dbo].[tblData_Submission_Comments]
        (Data_Submission_ID, Commenter_ID, Comment)
        VALUES (@ID, ${req.user.id}, @comment)

        SELECT [dbo].[tblData_Submissions].[Filename_Root],
        [dbo].[tblUsers].[Email]
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblUsers] on [dbo].[tblData_Submissions].[Submitter_ID] = UserID
        WHERE ID = @ID
    `;

  try {
    let result = await request.query(addCommentQuery);
    var datasetName = result.recordset[0].Filename_Root;
    var userEmail = result.recordset[0].Email;
    res.sendStatus(200);

    let emailClient = await awaitableEmailClient;

    var notificationContent;
    var notificationDestination;

    if (!req.user.isDataSubmissionAdmin) {
      // TEMP
      // notificationContent = emailTemplates.dataSubmissionUserComment(datasetName, comment);
      notificationContent = userCommentTemplate(datasetName, comment);
      notificationDestination = "cmap-data-submission@uw.edu";

      let dataSubmissionPhaseChange = new sql.Request(pool);
      dataSubmissionPhaseChange.input("filename", sql.NVarChar, datasetName);

      let dataSubmissionPhaseChangeQuery = `
                UPDATE [dbo].[tblData_Submissions]
                SET Phase_ID = ${qc1WasCompleted ? 7 : 2}
                WHERE Filename_Root = @filename
            `;
      const dataSubmissionPhaseChangeQueryResult = await dataSubmissionPhaseChange.query(
        dataSubmissionPhaseChangeQuery
      );
    } else {
      // TEMP
      // notificationContent = emailTemplates.dataSubmissionAdminComment(datasetName, comment);
      notificationContent = userCommentTemplate(datasetName, comment);
      notificationDestination = userEmail;
    }

    let notification =
      "From: 'me'\r\n" +
      "To: " +
      notificationDestination +
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
      console.log("Failed to enter new comment");
      console.log(e);
      return res.sendStatus(500);
    }
  } catch (e) {
    console.log("Failed to enter new comment");
    console.log(e);
    return res.sendStatus(500);
  }
};

module.exports = addComment;
