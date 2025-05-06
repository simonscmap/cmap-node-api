const sql = require('mssql');
const { userReadAndWritePool } = require('../../dbHandlers/dbPools');

// Retrieves comments for a single submission
const listComments = async (req, res) => {
  let pool = await userReadAndWritePool;
  let request = await new sql.Request(pool);

  let id = req.query.submissionID;

  if (!req.user.isDataSubmissionAdmin) {
    try {
      let checkOwnerRequest = new sql.Request(pool);
      checkOwnerRequest.input('ID', sql.Int, id);

      let checkOwnerQuery = `
                SELECT Submitter_ID from tblData_Submissions
                WHERE ID = @ID
            `;

      let checkOwnerResult = await checkOwnerRequest.query(checkOwnerQuery);
      let owner = checkOwnerResult.recordset[0].Submitter_ID;

      if (req.user.id !== owner) {
        return res.sendStatus(401);
      }
    } catch (e) {
      console.log(e);
      return res.sendStatus(500);
    }
  }

  request.input('ID', sql.Int, id);

  let query = `
        SELECT
            [tblData_Submission_Comments].[Data_Submission_ID],
            [tblData_Submission_Comments].Comment,
            [tblData_Submission_Comments].Comment_Date_Time,
            [tblUsers].[FirstName] as Commenter
        FROM tblData_Submission_Comments
        JOIN [tblUsers] ON [tblData_Submission_Comments].[Commenter_ID] = [tblUsers].[UserID]
        WHERE [tblData_Submission_Comments].[Data_Submission_ID] = @ID
    `;

  try {
    let response = await request.query(query);
    return res.json(response.recordset);
  } catch (e) {
    console.log(e);
    return res.sendStatus(500);
  }
};

module.exports = listComments;
