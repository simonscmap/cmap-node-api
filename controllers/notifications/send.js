const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");
const Future = require("fluture")
const { safePath } = require("../../utility/objectUtils");
const { sendServiceMail } = require("../../utility/email/sendMail");
const getNewsItem = require ("./getNewsItem");
const recipients = require ("./recipients");
const getTags = require("./getTags");
const insertEmail = require ("./insertEmail");
const insertRecipients = require("./insertRecipients");
const {
  renderGeneralNews,
  renderDatasetUpdate,
} = require("./preview");
const { monitor } = require("../../mail-service/checkBouncedMail");

const moduleLogger = initializeLogger("controllers/notifications/send");

const getNextEmailId = async (log = moduleLogger) => {
  const query = 'SELECT TOP 1 Email_ID FROM tblEmail_Sent ORDER BY Email_ID DESC';
  const [err, resp] = await directQuery (query, {}, log);
  const result = safePath (['recordset', 0, 'Email_ID' ]) (resp)
  console.log ('get next email Id result', result);
  const nextId = result + 1;
  return [err, nextId];
};


const send = async (req, res) => {
  const log = moduleLogger.setReqId (req.requestId);

  // 0. marshal payload
  //    - News_ID, modified_date

  const { newsId, modDate, tempId } = req.body;


  log.debug('executing send notification', { ...req.body})

  if (!newsId || !modDate) {
    log.warn ('request missing args', { args: {...req.body } });
    return res.status(400).send('Bad request: missing arguments');
  }

  const [newsErr, newsItem] = await getNewsItem (newsId, log);

  if (newsErr) {
    log.warn ('failed to fetch news item', { error: newsErr, newsId });
    return res.status(500).send('Error: could not fetch news item');
  }

  if (newsItem.modify_date && newsItem.modify_date.toISOString() !== modDate) {
    log.warn ('mismatch of modify_date', { newsItem, expectedModifyDate: modDate });
    return res.status(400).send('Error: modified_date does not match, request may be stale');
  }


  // 1. get recipients

  const [tagsErr, tags] = await getTags (newsId, log);

  if (tagsErr) {
    log.error ('error getting tagged datasets', { newsId, error: tagsErr });
    return res.status (500).send ('Error sending notifications')
  }

  const [projectedErr, projected] = await recipients.fetchProjected (tags, log);

  if (projectedErr) {
    log.error ('error getting recipients', { newsId, error: projectedErr });
    return res.status (500).send ('Error sending notifications');
  }


  // 2. apportion recipients to receive template
  // - if a user is both news and dataset subscribed, they will get only the news notification

  const { subscribed, newsSubscribers } = projected;

  // TEST TEST TEST
  newsSubscribers.push ({ userId: 1000, email: 'no-one@testnodomain.com'});

  const newsRecipients = newsSubscribers.map (nr => ({ ...nr, type: 'news' }));
  const datasetRecipients = subscribed
        .filter ((s) => !newsRecipients.find ((nr => nr.userId === s.userId)))
        .map (s => ({ ...s, type: 'dataset' }));


  // 3. record emails
  // - get last email id and increment
  // - create email content and record in tblEmail_Sent

  const [nextErr, nextId] = await getNextEmailId (log);

  if (nextErr) {
    log.error ('failed to get next email id', { emailId, error: nextErr });
    return res.status (500).send ('Error sending notifications');
  }

  const { headline, body } = newsItem;
  const newsEmailId = nextId;
  const datasetEmailId = nextId + 1;

  // -- insert #1 | "News" | nextId: newsEmailId
  const newsEmailContent = renderGeneralNews (headline, body, tags, newsEmailId);
  const [newsEmailErr, newsEmailSuccess] = await insertEmail ({
    nextId: newsEmailId,
    newsId,
    subject: newsItem.headline,
    body: newsEmailContent,
  });

  // -- insert #2 | "Dataset" | nextId: datasetEmailId
  const datasetEmailContent = renderDatasetUpdate (headline, body, tags, datasetEmailId);
  const [datasetEmailErr, datasetEmailSuccess] = await insertEmail ({
    nextId: datasetEmailId,
    newsId,
    subject: newsItem.headline,
    body: datasetEmailContent,
  });

  if (newsEmailErr || datasetEmailErr) {
    log.error ('error inserting email record', {
      newsEmailErr,
      datasetEmailErr,
      insertIds: [ nextId, nextId + 1 ]
    });
    return res.sendStatus (500);
  }

  // 4. send email

  const createSendJob = (recipient, subject, content) =>
        sendServiceMail ({ recipient, subject, content });

  const fullRecipientList = newsRecipients.concat (datasetRecipients);
  const sendJobs = fullRecipientList
        .map (recipient =>
          createSendJob (
            recipient.email,
            headline,
            (recipient.type === 'news' ? newsEmailContent : datasetEmailContent)
          ));

  const onTagFailure = (payload) => ({ success: false, ...payload });
  const onTagSuccess = (payload) => ({ success: true, ...payload });
  const taggedCoalesce = Future.coalesce (onTagFailure) (onTagSuccess);

  // send each email, and flag whether it was successfully sent
  Future.parallel (5) (sendJobs.map ((f) => taggedCoalesce (f)))
    .pipe (Future.map ((result) => {
      const processedResult = Array.isArray (result) && result.map ((r, ix) => {
        return {
          recipient: fullRecipientList[ix].email,
          success: r.success,
          emailId: (fullRecipientList[ix].type === 'news') ? nextId : nextId + 1,
        };
      });
      return processedResult;
    }))
    .pipe (Future.chain ((processedResult) => {
      // 5 on SUCCESS record email(s) in tblEmail_Recipients
      // - User_ID, Email_ID, Success
      return Future.attemptP (() => insertRecipients (processedResult, log));
    }))
    .pipe (Future.fork ((error) => {
      log.error ('parallel send notification failed', { newsId, error });
      res.status (500).json ({ message: 'Unexected error sending notification emails' });
      setTimeout (monitor, 100, [newsEmailId, datasetEmailId]);
    }) ((result) => {
      log.info ('sent notification emails', { newsId, result });
      res.json (result);
      // set timeout call checkBounceMail
      setTimeout (monitor, 100, [newsEmailId, datasetEmailId]);
    }));
}


module.exports = send;
