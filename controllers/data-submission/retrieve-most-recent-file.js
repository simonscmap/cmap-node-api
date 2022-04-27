const sql = require("mssql");

const { dropbox } = require("../../utility/Dropbox");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");

// Generates a temporary download link to the most recent version of a submission, and sends to client
exports.retrieveMostRecentFile = async (req, res) => {
  let pool = await userReadAndWritePool;
  let request = await new sql.Request(pool);

  let id = req.query.submissionID;
  request.input("ID", sql.Int, id);

  let query = `
        SELECT TOP 1
            [tblData_Submissions].[Filename_Root],
            [tblData_Submission_Files].[Timestamp]
        FROM [tblData_Submissions]
        JOIN [tblData_Submission_Files] ON [tblData_Submission_Files].[Submission_ID] = [tblData_Submissions].[ID]
        WHERE [tblData_Submissions].[ID] = @ID
        ORDER BY [tblData_Submission_Files].[Timestamp] DESC
    `;

  let result = await request.query(query);

  //TODO trim before entry so we don't need to do it everywhere else
  const dataset = result.recordset[0].Filename_Root.trim();
  const timestamp = result.recordset[0].Timestamp.trim();
  let path = `/${dataset}/${dataset}_${timestamp}.xlsx`;

  try {
    let boxResponse = await dropbox.filesGetTemporaryLink({ path });
    return res.json({ link: boxResponse.link, dataset });
  } catch (e) {
    console.log("Failed to get temporary download link");
    console.log(e);
    return res.sendStatus(500);
  }
};
