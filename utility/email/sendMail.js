const initializeLogger = require("../../log-service");
const base64url = require('base64-url');

const awaitableEmailClient = require("../emailAuth");

let log = initializeLogger("utility/email/sendMail");

const sendEmail = async (recipient, subject, content) => {
  let notification =
    "From: 'me'\r\n" +
    "To: " +
    recipient +
    "\r\n" +
    `Subject: Re: ${subject}\r\n` +
    "Content-Type: text/html; charset='UTF-8'\r\n" +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    content;

  console.log(content);

  let raw = base64url.encode(notification);

  let emailClient = await awaitableEmailClient;

  try {
    await emailClient.users.messages.send({
      userId: "me",
      resource: { raw },
    });
  } catch (e) {
    log.error("error sending mail", { subject, recipient });
  }
};

module.exports = sendEmail;
