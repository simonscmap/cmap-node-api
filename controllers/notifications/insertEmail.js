const sql = require("mssql");
const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");

const moduleLogger = initializeLogger("controllers/notifications/insertEmail");


const checkNoPreviousEmail = async (newsId, log = moduleLogger) => {
  const [err, resp] = await directQuery (
    `select Email_ID from tblEmail_Sent where News_ID = ${newsId}`,
    { poolName: 'rainierReadWrite'},
    log
  );

  if (err) {
    return [err];
  }
  return [false, resp.recordset];
}


const query = `INSERT INTO tblEmail_Sent
  (Email_ID, News_ID, Subject, Body, Date_Time)
  VALUES
  (@emailId, @newsId, @subject, @body, @date)`;

const insertEmail = async (content, log = moduleLogger) => {
  log.info ('creating record of notification email', {
    newsId: content.newsId,
    nextId: content.nextId,
    subject: content.subject,
  });


  // don't allow more than one email per news item
  const [checkErr, checkResp] = await checkNoPreviousEmail (content.newsId);
  if (checkErr) {
    return [new Error ('Error checking for previous notifications')];
  }
  if (checkResp.length > 0) {
    return [new Error ('Found previous notifications for news story')]
  }


  const options = {
    description: "insert email notification record",
    poolName: 'rainierReadWrite',
    input: (request) => {
      request.input ("emailId", sql.Int, content.nextId);
      request.input ("newsId", sql.Int, content.newsId);
      request.input ("subject", sql.NVarChar, content.subject);
      request.input ("body", sql.NVarChar, content.body);
      request.input ("date", sql.DateTime, (new Date ()).toISOString ());
    }
  };

  const [err, resp] = await directQuery (query, options, log);

  if (err) {
    log.error ('error creating email', { error: err, content })
    return [new Error ('error creating email record')];
  }

  log.info ('inserted new email notification record', {
    emailId: content.nextId,
    subject: content.subject,
    newsId: content.newsId
  })

  return [null, content.nextId];
}

module.exports = insertEmail;
