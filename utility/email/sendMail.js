const initializeLogger = require("../../log-service");
const base64url = require("base64-url");

const awaitableEmailClient = require("../emailAuth");

let log = initializeLogger("utility/email/sendMail");

// https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send
// 'me' is a special value, indicating to use the authenticated user
// which, in this case, is the one stored in credentials.json

const sendEmail = async (recipient, subject, content) => {
  let notification =
    "From: 'me'\r\n" +
    `To: ${recipient}\r\n` +
    `Subject: ${subject}\r\n` +
    "Content-Type: text/html; charset='UTF-8'\r\n" +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    content;

  let raw = base64url.encode(notification);

  let emailClient = await awaitableEmailClient;

  try {
    return await emailClient.users.messages.send({
      userId: "me",
      resource: { raw },
    });
  } catch (e) {
    log.error("error sending mail", { subject, recipient });
  }
};

module.exports = sendEmail;
