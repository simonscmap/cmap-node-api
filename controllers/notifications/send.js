// const sql = require("mssql");
// const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");
// const { safePath } = require("../../utility/objectUtils");

const moduleLogger = initializeLogger("controllers/notifications/send");


const send = async (req, res) => {
  const log = moduleLogger.setReqId (req.requestId);
  log.trace ('executing send notification')

  // 0. marshal payload
  //    - News_ID, subject, body, tags

  // 1. determine 1 or 2 email templates
  //    - if news item has tagged datasets, News email & Dataset email

  // 2. get subscribers for each

  // 3. generate new email id

  // 4. send email
  //    - get correct template

  // 5 on SUCCESS record email(s) in tblEmail_Sent & tblEmail_Recipients
  // - Email_ID, date, subject, body, News_ID

  return res.sendStatus (200)
}


module.exports = send;
