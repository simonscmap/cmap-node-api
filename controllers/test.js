// Test Email Controller

// This controller is not wired up in the api router, but can easily be plugged
// in during local development to test a variety of templates:
// the controller reads a template name as a parameter and tries to send an email
// with the body.mockData (which varies with the template)
const { userComment, adminComment } = require('../utility/email/templates');
const logWrapper = require('../log-service');
const sendMail = require('../utility/email/sendMail');

let log = logWrapper('test-controller');

const testEmailHandler = async (req, res) => {
  let templates = { userComment, adminComment };

  let { recipients, templateName, mockData } = req.body;

  let data = {
    ...mockData,
  };

  if (req.user) {
    data.userName = req.user.firstName;
  } else {
    log.warn('no user info');
  }

  if (templates[templateName]) {
    let content = templates[templateName](data);
    await recipients.forEach(async (recipient) =>
      sendMail(recipient, 'Test Email', content),
    );
    res.sendStatus(200);
  } else {
    res.sendStatus(400);
    log.error('no template found', { recipients, templateName, mockData });
  }
};

module.exports = {
  testEmailHandler,
};
