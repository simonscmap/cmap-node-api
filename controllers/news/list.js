const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const initializeLogger = require("../../log-service");
<<<<<<< HEAD
=======
const log = initializeLogger("controllers/news/list");
>>>>>>> ed38a30 (wip: create news controller, routes with create/publish/list)

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

<<<<<<< HEAD
const log = initializeLogger("controllers/news/list");

=======
>>>>>>> ed38a30 (wip: create news controller, routes with create/publish/list)
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
<<<<<<< HEAD
    return;
  }

  if (result) {
    log.trace("returning news results");
=======
  }

  if (result) {
>>>>>>> ed38a30 (wip: create news controller, routes with create/publish/list)
    res.status(200).send(result.recordset);
    return;
  }

<<<<<<< HEAD
  log.error("unknown error listing news")
  res.status(500).send("unknown error");
=======
  log.trace("returning news results");
  res.status(200).send(result);

>>>>>>> ed38a30 (wip: create news controller, routes with create/publish/list)
  return;
};
