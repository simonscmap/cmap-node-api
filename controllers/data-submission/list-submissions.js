const sql = require("mssql");
const {
  userReadAndWritePool,
} = require("../../dbHandlers/dbPools");

// Fetch all data submissions.
// Used to populate admin dashboard
const submissions = async (req, res) => {
  let pool = await userReadAndWritePool;
  let request = await new sql.Request(pool);
  // let includeCompleted = req.query.includeCompleted;

  // TODO make into a sproc
  let query = `
        SELECT
            [dbo].[tblData_Submissions].[Filename_Root] as Dataset,
            [dbo].[tblData_Submissions].[Dataset_Long_Name],
            [dbo].[tblData_Submissions].[Data_Source],
            [dbo].[tblData_Submissions].[ID] as Submission_ID,
            [dbo].[tblData_Submission_Phases].[Phase],
            [dbo].[tblData_Submissions].[Phase_ID],
            [dbo].[tblData_Submissions].[Start_Date_Time],
            [dbo].[tblData_Submissions].[Ingestion_Date_Time],
            CONCAT([dbo].[tblUsers].[FirstName], ' ', [dbo].[tblUsers].[FamilyName]) as Name
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblData_Submission_Phases] ON [tblData_Submissions].[Phase_ID] = [tblData_Submission_Phases].[ID]
        JOIN [dbo].[tblUsers] on [tblData_Submissions].[Submitter_ID] = [dbo].[tblUsers].UserID
        ORDER BY [dbo].[tblData_Submissions].[Phase_ID]
        `;


  // TODO error handling????
  let result = await request.query(query);
  return res.json(result.recordset);
};

module.exports = submissions
