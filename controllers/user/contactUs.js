const base64url = require("base64-url");
const awaitableEmailClient = require("../../utility/emailAuth");
const emailTemplates = require("../../utility/emailTemplates");
const initializeLogger = require("../../log-service");
// TODO switch to sendMail
// const templates = require("../../utility/email/templates");
// const sendMail = require("../../utility/email/sendMail");

const log = initializeLogger("controllers/user/contactUs");

module.exports = async (req, res) => {
  log.trace('contact us controller')
  let payload = req.body;

  let emailClient = await awaitableEmailClient;
  let content = emailTemplates.contactUs(payload);
  let message =
    "From: 'me'\r\n" +
    "To: simonscmap@uw.edu\r\n" +
    "Subject: Message from Simons CMAP User\r\n" +
    content;

  let raw = base64url.encode(message);

  try {
    await emailClient.users.messages.send({
      userId: "me",
      resource: {
        raw,
      },
    });

    log.trace('successfully sent message')
    res.sendStatus(200);
    return;
  } catch (e) {
    log.error("error generating email from user contactUs message", { content });
    res.sendStatus(500);
    return;
  }
};
