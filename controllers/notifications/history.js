const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");
const { safePath } = require("../../utility/objectUtils");
const recipients = require("./recipients");

const moduleLogger = initializeLogger("controllers/notifications/history");

// fetch history and recipient data (past actual and projected)
const fetch = async (args) => {
  const log = moduleLogger;

  const constraint = (args && args.emailId)
        ? `WHERE Email_ID=${args.emailId}`
        : '';

  const query = `
       SELECT sent.Email_ID, News_ID, Subject, Body, Date_Time
       FROM tblEmail_Sent sent
       GROUP BY sent.Email_ID, News_ID, Date_Time, Subject, Body
`;

  const options = {
    description: "get a full list of short names",
    poolName: 'rainier',
  };

  const [err, resp] = await directQuery (query, options, log);

  if (err) {
    return [err, null];
  }

  const sentEmails = safePath (['recordset']) (resp);

  const [pastErr, pastActual] = await recipients.fetchPastActual ();

  const payload = sentEmails;
  if (pastActual && Array.isArray (sentEmails)) {
    sentEmails.forEach (e => {
      e.recipients = {
        actual: pastActual[e.Email_ID] || null,
      };
    });
  }

  return [null, payload];
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
    return res.status (500).send ('Error retrieving notification history');
  }

  const payload = Array.isArray (result) && result.reduce ((acc, curr) => {
    const newsId = curr.News_ID;
    if (Array.isArray (acc[newsId])) {
      acc[newsId].push (curr);
    } else {
      acc[newsId] = [curr];
    }
    return acc;
  }, {});

  return res.json (payload);
};


module.exports = history;
