const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const initializeLogger = require("../../log-service");

let query = `SELECT TOP (1000) [ID]
      ,[headline]
      ,[link]
      ,[body]
      ,[date]
      ,[rank]
      ,[view_status]
      ,[create_date]
      ,[modify_date]
      ,[publish_date]
  FROM [Opedia].[dbo].[tblNews]`;

const log = initializeLogger("controllers/news/list");

module.exports = async (req, res) => {
  log.trace("requesting news");

  let pool = await pools.userReadAndWritePool;
  let request = await new sql.Request(pool);

  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error("error requesting news", { error: e });
    res.status(500).send("Error retrieving news");
    return;
  }

  if (result) {
    log.trace("returning news results");
    res.status(200).send(result.recordset);
    return;
  }

  log.error("unknown error listing news")
  res.status(500).send("unknown error");
  return;
};
