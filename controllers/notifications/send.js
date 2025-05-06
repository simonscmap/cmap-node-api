const directQuery = require('../../utility/directQuery');
const Future = require('fluture');
const { safePath } = require('../../utility/objectUtils');
const { sendServiceMail } = require('../../utility/email/sendMail');
const getNewsItem = require('./getNewsItem');
const recipients = require('./recipients');
const getTags = require('./getTags');
const insertEmail = require('./insertEmail');
const insertRecipients = require('./insertRecipients');
const {
  renderGeneralNews,
  // renderDatasetUpdate,
} = require('./preview');
const { monitor } = require('../../mail-service/checkBouncedMail');
const env = require('../../config/environment');
const initializeLogger = require('../../log-service');

const { map, chain, coalesce, fork, parallel, attemptP } = Future;

const moduleLogger = initializeLogger('controllers/notifications/send');

// helpers

const getNextEmailId = async (log = moduleLogger) => {
  const query =
    'SELECT TOP 1 Email_ID FROM tblEmail_Sent ORDER BY Email_ID DESC';
  const [err, resp] = await directQuery(query, {}, log);
  const result = safePath(['recordset', 0, 'Email_ID'])(resp);
  const nextId = (result || 0) + 1;
  return [err, nextId];
};

const createSendJob = (recipient, subject, content) =>
  sendServiceMail({ recipient, subject, content });

const createSendJobs = (recipientList, subject, content) =>
  recipientList.map((recipient) =>
    createSendJob(recipient.email, `Simons CMAP News: ${subject}`, content),
  );

// coalesce prevents one failed job from cancelling the execution of any remaning jobs
// in the Future.parallel --
// insteade it returns both success and failure payloads with a "success" property
// see test/sendMultipleEmails.test.js
// see https://github.com/fluture-js/Fluture?tab=readme-ov-file#coalesce
const onTagFailure = (payload) => ({ success: false, ...payload });
const onTagSuccess = (payload) => ({ success: true, ...payload });
const taggedCoalesce = coalesce(onTagFailure)(onTagSuccess);

// ProcessedResult :: emailId -> recipientList -> result -> { recipient, success, emailId }
const processSendResult = (emailId) => (fullRecipientList) => (result) => {
  if (env.isDevelopment) {
    console.log('raw send result');
    console.table(result);
  }
  const processedResult =
    Array.isArray(result) &&
    result.map((r, ix) => {
      return {
        recipient: fullRecipientList[ix].email,
        success: r.success,
        emailId,
      };
    });
  return processedResult;
};

// given an array of jobs (futures)
// create a Future.parallel
// and process results
// :: [ SendFuture ] -> Future ([ ProcessedResult ])
const createSendFuture = (sendJobs, emailId, recipientList) =>
  parallel(5)(sendJobs.map((f) => taggedCoalesce(f))).pipe(
    map(processSendResult(emailId)(recipientList)),
  );

// CONTROLLER
const send = async (req, res) => {
  const log = moduleLogger.setReqId(req.requestId);

  // 0. marshal payload
  //    - News_ID, modified_date

  const { newsId, modDate /* tempId */ } = req.body;
  log.info('starting send email notifications', { newsId });

  if (!newsId || !modDate) {
    log.warn('request missing args', { args: { ...req.body } });
    return res.status(400).send('Bad request: missing arguments');
  }

  const [newsErr, newsItem] = await getNewsItem(newsId, log);
  if (newsErr) {
    log.warn('failed to fetch news item', { error: newsErr, newsId });
    return res.status(500).send('Error: could not fetch news item');
  }

  if (newsItem.modify_date && newsItem.modify_date.toISOString() !== modDate) {
    log.warn('mismatch of modify_date', {
      newsItem,
      expectedModifyDate: modDate,
    });
    return res
      .status(400)
      .send('Error: modified_date does not match, request may be stale');
  }

  // 1. get recipients

  const [tagsErr, tagsInfo] = await getTags(newsId, log);
  if (tagsErr) {
    log.error('error getting tagged datasets', { newsId, error: tagsErr });
    return res.status(500).send('Error sending notifications');
  }

  const tags = tagsInfo.map((t) => t.Dataset_Name);
  const [projectedErr, projected] = await recipients.fetchProjected(tags, log);

  if (projectedErr) {
    log.error('error getting recipients', { newsId, error: projectedErr });
    return res.status(500).send('Error sending notifications');
  }

  // 2. apportion recipients to receive template
  // - if a user is both news and dataset subscribed, they will get only the news notification

  // NewsSubscriber :: { userId, datasetId }
  const { subscribed, newsSubscribers } = projected;

  const newsRecipients = newsSubscribers.map((nr) => ({ ...nr, type: 'news' }));
  const datasetRecipients = subscribed
    .filter((s) => !newsRecipients.find((nr) => nr.userId === s.userId))
    .map((s) => ({ ...s, type: 'dataset' }));

  // 3. record emails
  // - get last email id and increment
  // - create email content and record in tblEmail_Sent

  const [nextErr, nextId] = await getNextEmailId(log);

  if (nextErr) {
    log.error('failed to get next email id', { emailId, error: nextErr });
    return res.status(500).send('Error sending notifications');
  }

  const { headline, body } = newsItem;
  const newsEmailId = nextId;
  // const datasetEmailId = nextId + 1;

  // -- insert #1 | "News" | nextId: newsEmailId
  const newsEmailContent = renderGeneralNews(headline, body, tags, newsEmailId);
  const [newsEmailErr /* newsEmailSuccess */] = await insertEmail({
    nextId: newsEmailId,
    newsId,
    subject: newsItem.headline,
    body: newsEmailContent,
  });

  // -- insert #2 | "Dataset" | nextId: datasetEmailId
  // const datasetEmailContent = renderDatasetUpdate (headline, body, tags, datasetEmailId);
  // const [datasetEmailErr, datasetEmailSuccess] = await insertEmail ({
  //   nextId: datasetEmailId,
  //   newsId,
  //   subject: newsItem.headline,
  //   body: datasetEmailContent,
  // });

  if (newsEmailErr) {
    log.error('error inserting email record', {
      newsEmailErr,
      nextId,
    });
    return res.status(500).send(newsEmailErr.message);
  }

  // 4. send email

  const fullRecipientList = newsRecipients.concat(datasetRecipients);
  const sendJobs = createSendJobs(
    fullRecipientList,
    headline,
    newsEmailContent,
  );

  // send each email
  // flag whether it was successfully sent
  createSendFuture(sendJobs, newsEmailId, fullRecipientList)
    .pipe(
      chain((processedResult) => {
        // 5. on SUCCESS record email(s) in tblEmail_Recipients
        return attemptP(() => insertRecipients(processedResult, log));
      }),
    )
    .pipe(
      map((result) => {
        // Log Result in Development
        if (env.isDevelopment) {
          console.table(result);
        } else {
          if (Array.isArray(result)) {
            result.forEach((r) => log.info('notification email result', r));
          }
        }
        // 6. trigger monitor
        setTimeout(monitor, 100, [newsEmailId]);
        return result;
      }),
    )
    .pipe(
      fork((error) => {
        log.error('parallel send notification failed', { newsId, error });
        res.status(500).send('Unexected error sending notification emails');
      })((result) => {
        log.info('sent notification emails', { newsId });
        res.json(result);
      }),
    );
};

module.exports.controller = send;
module.exports.createSendFuture = createSendFuture;
module.exports.createSendJobs = createSendJobs;
