// const Future = require("fluture");
const S = require("../sanctuary");
// const initializeLogger = require("../../log-service");
const base64url = require("base64-url");
// const { init } = require("../oAuth");

const { compose } = S;
// const { fork } = Future;

// let log = initializeLogger("utility/email/sendMail");

// https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send
// 'me' is a special value, indicating to use the authenticated user
// which, in this case, is the one stored in credentials.json

const assembleMail = recipient => subject => content => ("From: 'me'\r\n" +
    `To: ${recipient}\r\n` +
    `Subject: ${subject}\r\n` +
    "Content-Type: text/html; charset='UTF-8'\r\n" +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    content);

const prepareMail = compose (compose (compose (base64url.encode))) (assembleMail);

const send = client => raw =>
  client.users.messages.send({
    userId: "me",
    resource: {
      raw: raw
    },
  });

// send mail via provided client
// @futureClient is a future of the google mail client
// @mailArgs is a StrObj with recipient, subject and content
const sendMail = (futureClient) => (mailArgs) => {
  let { recipient, subject, content } = mailArgs;
  let raw = prepareMail (recipient) (subject) (content);
  return futureClient
    .pipe(S.map ((client) => {
      send (client) (raw);
    }))
}

module.exports.assembleMail = assembleMail;
module.exports.prepareMail = prepareMail;
module.exports.sendMailF = sendMail;
