const sql = require("mssql");
const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");
const { safePath } = require("../../utility/objectUtils");

const moduleLogger = initializeLogger("controllers/notifications/history");

// fetch history
const fetch = async (args) => {
  let log = moduleLogger;

  const constraint = args.emailId
        ? `WHERE Email_ID=${args.emailId}`
        : '';

  const query = `SELECT *
                 FROM tblEmail_Sent
                 ${constraint}`; // GROUP BY date DESC ??
  const options = {
    description: "get a full list of short names"
  };

  const [err, resp] = await directQuery (query, options, log);

  if (err) {
    return [err, null];
  }

  const result = safePath (['recordset']) (resp)

  return [null, result];
}

// history controller
const history = async (req, res, next) => {
  const log = moduleLogger.setReqId (req.requestId);
  log.trace ('resolving notification history');

  // args
  const args = req.body;

  // call
  const [err, result] = await fetch (args);

  // response
  if (err) {
    return res.status (500).sene ('Error retrieving notification history');
  }

  return res.json (result);
}


module.exports = history;
