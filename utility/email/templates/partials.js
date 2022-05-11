const fs = require('fs');
const path = require('path');

const initializeLogger = require('../../../log-service');
const log = initializeLogger('utility/email/templates');

let partialsNames = [
  'notifyUserOfReceiptOfUpdatedDataSubmission',
  'notifyUserOfReceiptOfNewDataSubmission',
  'notifyAdminOfDataSubmission',
  'notifyAdminOfUserComment',
  'notifyUserOfAdminComment',
  'userResetPassword',
];

// read in email templates and export them as strings

const partials = partialsNames.reduce((acc, name) => {
  const pathToTemplate = path.resolve(__dirname, 'mustache', `${name}.mustache`);
  try {
    acc[name] = fs.readFileSync(pathToTemplate, 'utf8');
  } catch (e) {
    log.error('failed to read template file', { templateName: name, error: e });
    process.exit(1);
  }
  return acc;
}, {});

module.exports = partials
