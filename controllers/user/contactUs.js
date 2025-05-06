const initializeLogger = require('../../log-service');
const templates = require('../../utility/email/templates');
const { sendServiceMail } = require('../../utility/email/sendMail');
const {
  CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
} = require('../../utility/constants');
const Future = require('fluture');

const log = initializeLogger('controllers/user/contactUs');

module.exports = async (req, res) => {
  log.trace('contact us controller');
  let payload = req.body;

  let content = templates.notifyAdminOfUserContact(payload);

  let mailArgs = {
    recipient: CMAP_DATA_SUBMISSION_EMAIL_ADDRESS,
    subject: 'New Contact-Us Submision',
    content,
  };

  let sendMailFuture = sendServiceMail(mailArgs);

  let reject = (e) => {
    log.error('failed to notify admin of new comment', {
      recipient: mailArgs.recipient,
      error: e,
    });
    res.status(500).send('error sending message');
  };

  let resolve = () => {
    log.info('email sent', {
      recipient: mailArgs.recipient,
      subject: mailArgs.subject,
    });
    res.sendStatus(200);
  };

  // execute the send function
  // see https://github.com/fluture-js/Fluture#fork

  Future.fork(reject)(resolve)(sendMailFuture);
};
