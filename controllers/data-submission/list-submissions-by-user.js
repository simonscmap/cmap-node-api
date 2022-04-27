const sql = require("mssql");
const { dataReadOnlyPool } = require("../../dbHandlers/dbPools");

// Retrieve submissions for a single user. Used by user dashboard
const submissionsByUser = async (req, res) => {
  let pool = await dataReadOnlyPool;
  let request = await new sql.Request(pool);

  let userID = req.user.id;

  let query = `
        SELECT
            [dbo].[tblData_Submissions].[Filename_Root] as Dataset,
            [dbo].[tblData_Submissions].[ID] as Submission_ID,
            [dbo].[tblData_Submission_Phases].[Phase],
            [dbo].[tblData_Submissions].[Ingestion_Date_Time],
            [dbo].[tblData_Submissions].[QC1_Completion_Date_Time],
            [dbo].[tblData_Submissions].[QC2_Completion_Date_Time],
            [dbo].[tblData_Submissions].[DOI_Accepted_Date_Time],
            [dbo].[tblData_Submissions].[Start_Date_Time]
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblData_Submission_Phases] ON [tblData_Submissions].[Phase_ID] = [tblData_Submission_Phases].[ID]
        WHERE Submitter_ID = ${userID}
    `;

  // TODO error handling??
  let result = await request.query(query);
  return res.json(result.recordset);
};

module.exports = submissionsByUser;
