const { userComment, adminComment } = require('../utility/email/templates');
const logWrapper = require("../log-service");
const sendMail = require('../utility/email/sendMail');

let log = logWrapper("test-controller");

const testEmailHandler = async (req, res) => {
  let templates = { userComment, adminComment };

  let { recipients, templateName, mockData } = req.body;

  let data = {
    ...mockData,
  }

  if (req.user) {
    data.userName = req.user.firstName;
  } else {
    log.warn('no user info');
  }

  if (templates[templateName]) {
    let content = templates[templateName](data);
    await recipients.forEach(async (recipient) => sendMail(recipient, "Test Email", content));
    res.sendStatus(200);
  } else {
    res.sendStatus(400);
    log.error('no template found', {recipients, temlpateName, mockData});
  }
};

module.exports = {
  testEmailHandler,
};
