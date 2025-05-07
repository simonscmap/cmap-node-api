// Wrapper to simplify sending email notifications to admin
const Future = require('fluture');
const templates = require('./templates');
const { sendServiceMail } = require('./sendMail');
const initializeLogger = require('../../log-service');

const log = initializeLogger('email/notifyAdmin');

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';

const recipients = ['mdehghan@uw.edu', 'simonscmap@uw.edu', 'hwk@uw.edu'];

const sendNotification = (title, messageText) => {
  if (!isStaging && !isProduction) {
    log.debug('prevent send notify mail in local env', { title, messageText });
    return;
  }

  const content = templates.notifyAdmin({ title, messageText });

  const args = {
    subject: title,
    title,
    content,
  };

  const jobs = recipients.map((email) =>
    sendServiceMail({ ...args, recipient: email }),
  );
  const send = Future.parallel(5)(jobs);

  let reject = (e) => {
    log.error('failed to send admin notifaction', { error: e });
  };

  let resolve = () => {
    log.info('admin notification sent', { title });
  };

  // execute
  Future.fork(reject)(resolve)(send);

  return;
};

module.exports = sendNotification;
