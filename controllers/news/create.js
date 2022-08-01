const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const initializeLogger = require("../../log-service");

const log = initializeLogger("controllers/news/create");

/*
   This controller creates a new News Item in tblNews

   Peculiarities:

   - the client specifies the ID (which is not auto-incremented)
   - view_status will be automatically set to 'preview' for create items;
     thus creating a news story will never publish it, that must be a
     separate action

   Dates:

 */

let query = `INSERT INTO [Opedia].[dbo].[tblNews]
      (ID, headline, link, body, date, rank, view_status, create_date, UserID)
      VALUES (
         @ID
       , @headline
       , @link
       , @body
       , @date
       , @rank
       , @view_status
       , @create_date
       , @UserId
      )`;

const requiredKeys = [
  "id",
  "headline",
  "link",
  "body",
  "date",
  "rank",
  "viewStatus",
];

module.exports = async (req, res) => {
  log.info("request for create news story", { reqBody: req.body });

  if (!req.body.story) {
    log.warn("no data provided", { reqBody: req.body });
    res.status(400).send("Bad request: no 'story' data provided");
    return;
  }

  let story = req.body.story;

  let missingKeys = requiredKeys.filter((key) => {
    if (!story[key]) {
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

  let { id, headline, link, body, date, rank, viewStatus } = story;
  let createDate = new Date().toISOString();

  let parsedBody;
  try {
    // ensure valid json
    parsedBody = JSON.stringify(JSON.parse(body));
  } catch (e) {
    log.warn(
      "request to create news item provided invalid json for body field",
      { body }
    );
    res.status(400).send("Bad request: invalid json format for 'body' field");
    return;
  }

  log.trace("inserting new news item");

  let pool = await pools.userReadAndWritePool;
  let request = new sql.Request(pool);

  // input
  request.input("ID", sql.Int, id);
  request.input("headline", sql.NVarChar, headline);
  request.input("link", sql.NVarChar, link);
  request.input("body", sql.NVarChar, parsedBody);
  request.input("date", sql.NVarChar, date);
  request.input("rank", sql.Int, rank);
  request.input("view_status", sql.Int, viewStatus);
  request.input("create_date", sql.DateTime, createDate);
  request.input("UserId", sql.Int, req.user.id);

  let result;

  try {
    result = await request.query(query);
  } catch (e) {
    log.error("error inserting new news item", { error: e });
    res.status(500).send("Error creating news item");
    return;
  }

  if (result) {
    log.info("success creating news item", { result });
    res.status(200).send(result.recordset);
    return;
  }

  log.error("unknown error creating news item");
  res.sendStatus(500);
  return;
};
