const sql = require("mssql");
const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");

const moduleLogger = initializeLogger("controllers/notifications/insertEmail");

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
    return [err];
  }

  log.info ('inserted new email notification record', {
    emailId: content.nextId,
    subject: content.subject,
    newsId: content.newsId
  })

  return [null, content.nextId];
}

module.exports = insertEmail;
