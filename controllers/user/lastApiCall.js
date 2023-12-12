const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/lastApiCall");


// return time of last api call for user
module.exports = async (req, res, next) => {
  const pool = await pools.dataReadOnlyPool;
  const request = new sql.Request(pool);

  request.input("userID", sql.Int, req.user.id);

  const query = `SELECT TOP 1 date_time from tblapi_calls
                 WHERE user_id = @userID
                 AND query IS NOT NULL
                 ORDER BY date_time DESC`;

  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error("error retrieving last api call for user", {
      error: e,
      userId: req.user.id,
    });
    return res.status(500).send ('error retrieving last api call');
  }

  if (result && result.recordset && result.recordset.length) {
    res.json(result.recordset[0]);
  }

  return next();
};
