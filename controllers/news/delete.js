const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const initializeLogger = require("../../log-service");

/*
   This controller provides means to delete a news item.

   This function should not be confused with setting the view_status
   of a news item to 'hidden'; deleting a news item removes the
   record from the database.

 */

const log = initializeLogger("controllers/news/delete");

let query = `DELETE [Opedia].[dbo].[tblNews]
      WHERE id = @ID`;

const requiredKeys = ["id"];

module.exports = async (req, res) => {
  log.trace("request to delete news item", { newsId: req.body && req.body.id });

  let missingKeys = requiredKeys.filter((key) => {
    if (!req.body[key]) {
      return true;
    }
    return false;
  });

  if (missingKeys.length > 0) {
    log.info("missing fields", missingKeys);
    res
      .status(400)
      .send(`Bad request: missing fields ${missingKeys.join(",")}`);
    return;
  }

  let { id } = req.body;


  let pool = await pools.userReadAndWritePool;
  let request = new sql.Request(pool);

  // input
  request.input("ID", sql.Int, id);

  // start query
  log.trace("delete news item");

  let result;

  try {
    result = await request.query(query);
  } catch (e) {
    log.error("error deleting news item", { error: e });
    res.status(500).send("Error deleting news item");
    return;
  }

  if (result) {
    log.info("success deleting news item", { result });
    res.status(200).send(result.recordset);
    return;
  }

  log.error("unknown error deleting news item");
  res.sendStatus(500);
  return;
};
