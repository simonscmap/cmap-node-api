const directQuery = require('../../utility/directQuery');
const initializeLogger = require('../../log-service');
const Future = require('fluture');
const updateRecipients = require('./updateRecipients');
const { monitor } = require('../../mail-service/checkBouncedMail');
const { createSendFuture, createSendJobs } = require('./send');

const { map, chain, fork, attemptP } = Future;

const moduleLogger = initializeLogger('controllers/notifications/re-send');

// 1. get history for email id

const getHistory = async (emailId, log = moduleLogger) => {
  const query = `SELECT er.User_ID, er.Email_ID, er.Success, er.Attempt, er.Last_Attempt_Date_Time, u.Email
                 FROM tblEmail_Recipients er
                 JOIN tblUsers u ON u.UserID = er.User_ID
                 WHERE Success = 0
                 AND Email_ID = ${emailId}`;
  const options = {
    description: 'get failed recipients of email notification',
    poolName: 'rainierReadWrite',
  };

  const [err, result] = await directQuery(query, options);

  if (err) {
    log.error('failed to retrieve failid recipient records', { err, updates });
    return [err];
  }

  if (result.recordset) {
    const records = result.recordset;
    const list = records.map((m) => ({
      userId: m.User_ID,
      email: m.Email,
      emailId: m.Email_ID,
      success: m.Success,
      attempt: m.Attempt,
      lastAttempt: m.Last_Attempt_Date_Time,
    }));
    return [false, list];
  }
  return [true];
};

// 2. get rendered email
const getRender = async (emailId, log = moduleLogger) => {
  const query = `SELECT * from tblEmail_Sent
                 WHERE Email_ID = ${emailId}`;
  const options = {
    description: 'get previously sent email notification',
    poolName: 'rainierReadWrite',
  };

  const [err, result] = await directQuery(query, options);

  if (
    err ||
    !Array.isArray(result.recordset) ||
    result.recordset.length === 0
  ) {
    log.error('failed to retrieve sent email record', { err, updates });
    return [err];
  }
  return [false, result.recordset];
};

// CONTROLLER

const reSend = async (req, res) => {
  const log = moduleLogger.setReqId(req.requestId);
  const { emailId } = req.body;

  log.info('starting re-send notifications', { emailId });

  // 1. get history for email id
  const [histErr, failedRecipients] = await getHistory(emailId, log);
  if (histErr) {
    return res.status(500).send('Error retrieving failed recipients');
  }

  if (failedRecipients.length === 0 || !Array.isArray(failedRecipients)) {
    // nothing to do
    log.warn('no failed recipient list', { failedRecipients, emailId });
    return res.status(200).json({});
  }

  // 2. get prev sent email and resend to recipients
  const [renderErr, sentEmail] = await getRender(emailId, log);
  if (renderErr) {
    return res.status(500).send('Error retrieving email content');
  }

  const { Body, Subject } = sentEmail;

  // 3. resend
  log.info('creating re-send jobs', { failedRecipients, Subject });
  const jobs = createSendJobs(failedRecipients, Subject, Body);
  const reSendFuture = createSendFuture(jobs, emailId, failedRecipients);

  log.info('re-sending', { emailId, numberOfRecipients: jobs.length });

  reSendFuture
    .pipe(
      chain((processedResult) => {
        // 4. record attempt / success
        return attemptP(() => updateRecipients(processedResult, log));
      }),
    )
    .pipe(
      map((result) => {
        // 5 trigger monitor
        setTimeout(monitor, 100, [emailId]);
        return result;
      }),
    )
    .pipe(
      fork((error) => {
        log.error('parallel send notification failed', { emailId, error });
        res.status(500).send('Unexected error sending notification emails');
      })((result) => {
        log.info('re-sent notification emails', { emailId, result });
        if (Array.isArray(result)) {
          result.forEach((r) =>
            log.info('re-sent notification email result', r),
          );
        }
        res.json(result);
      }),
    );
};

module.exports = reSend;
