const sql = require('mssql');

const { dropbox } = require('../../utility/Dropbox');
const { userReadAndWritePool } = require('../../dbHandlers/dbPools');

const initializeLogger = require('../../log-service');
const log = initializeLogger('controllers/data-submission/commit-upload');

// Generates a temporary download link to the most recent version of a submission, and sends to client
const retrieveMostRecentFile = async (req, res) => {
  let pool = await userReadAndWritePool;
  let request = await new sql.Request(pool);

  let id = req.query.submissionID;
  request.input('ID', sql.Int, id);

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

  log.info('retrieve last file submission info', { dataset, timestamp, path });

  try {
    let boxResponse = await dropbox.filesGetTemporaryLink({ path });
    log.info('dropbox temp link response', { ...boxResponse });
    return res.json({
      link: boxResponse.result.link,
      dataset,
      submissionId: id,
    });
  } catch (e) {
    log.error('Failed to get temporary download link', e);
    return res.sendStatus(500);
  }
};

module.exports = retrieveMostRecentFile;
