const Future = require('fluture');
const S = require('../sanctuary');
const initializeLogger = require('../../log-service');
const base64url = require('base64-url');
const { init } = require('../oAuth');
const { getGmailClient } = require('../serviceAccountAuth');
const { compose } = S;

let log = initializeLogger('utility/email/sendMail');

// https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send
// 'me' is a special value, indicating to use the authenticated user
// which, in this case, is the one stored in credentials.json

// assemble mail
const assembleMail = (recipient) => (subject) => (content) =>
  "From: 'me'\r\n" +
  `To: ${recipient}\r\n` +
  `Subject: ${subject}\r\n` +
  "Content-Type: text/html; charset='UTF-8'\r\n" +
  'Content-Transfer-Encoding: base64\r\n\r\n' +
  content;

// produce raw, base64 encoded mail
const prepareMail = compose(compose(compose(base64url.encode)))(assembleMail);

// send mail via a service account with JWT
// depends upon the presence of the key file to
// generate a working gmailClient
const sendServiceMail = (mailArgs) => {
  let { recipient, subject, content } = mailArgs;

  log.info('preparing to send service mail', { recipient, subject });

  let raw = prepareMail(recipient)(subject)(content);
  let gmailClient = getGmailClient();

  return Future.attemptP(() =>
    gmailClient.users.messages.send({
      userId: 'me',
      resource: { raw },
    }),
  );
};

module.exports.assembleMail = assembleMail;
module.exports.prepareMail = prepareMail;
module.exports.sendServiceMail = sendServiceMail;

/*
 *
 *  Below are the older sendMail functions which read the token file
 *  when using the now-deprecated oauth method
 *
 *  They are no longer used, but kept here in case a similar use arises in the future
 */

// curried send function, wrapping the google client
const send = (client) => (raw) =>
  client.users.messages.send({
    userId: 'me',
    resource: {
      raw: raw,
    },
  });

// send mail via provided client
// @futureClient is a future of the google mail client
// @mailArgs is a StrObj with recipient, subject and content

// NOTE: the client is provided as a future BECAUSE it can fail,
// either in failing to read the token, the credentials, or in
// instantiating the client itself; THUS, any of these failures
// will surface when sendMail is forked
const sendMail = (futureClient) => (mailArgs) => {
  let { recipient, subject, content } = mailArgs;

  log.info('preparing sendMail future', { recipient, subject });

  let raw = prepareMail(recipient)(subject)(content);

  return futureClient.pipe(
    S.map((client) => {
      send(client)(raw);
    }),
  );
};

module.exports.sendMailF = sendMail;
module.exports.sendMail = sendMail(init);
