// const sql = require("mssql");
// const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");
// const { safePath } = require("../../utility/objectUtils");

const moduleLogger = initializeLogger("controllers/notifications/send");


const send = async (req, res) => {
  const log = moduleLogger.setReqId (req.requestId);
  log.trace ('executing send notification')

  return res.sendStatus (200)
}


module.exports = send;
