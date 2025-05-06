const sql = require('mssql');

const { userReadAndWritePool } = require('../../dbHandlers/dbPools');

// Deletes a data submission. Used on admin dashboard
exports.deleteSubmission = async (req, res, next) => {
  let pool = await userReadAndWritePool;
  let request = await new sql.Request(pool);

  try {
    request.input('submissionID', sql.Int, req.query.submissionID);
    let query = `DELETE FROM tblData_Submissions WHERE ID = @submissionID`;

    await request.query(query);
    res.sendStatus(200);
    return next();
  } catch (e) {
    console.log('Failed to delete dataset');
    console.log(e);
    res.sendStatus(500);
  }
};
