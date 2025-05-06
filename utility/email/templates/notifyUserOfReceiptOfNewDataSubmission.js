// Notify User of Receipt of New Data Submission
const Mustache = require('mustache');
const baseTemplate = require('./base-template');
const { notifyUserOfReceiptOfNewDataSubmission } = require('./partials');

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const domain = isProduction
  ? 'https://simonscmap.com'
  : isStaging
    ? 'https://simonscmap.dev'
    : 'http://localhost:8080';

const render = ({ datasetName, user }) => {
  // mustache.render :: template -> data -> partials -> render
  return Mustache.render(
    baseTemplate,
    {
      datasetName: encodeURI(datasetName),
      messageType: 'Notification',
      messageTitle: 'New Data Submission Received',
      addressee: `${user.firstName}`,
      domain,
    },
    {
      messageBody: notifyUserOfReceiptOfNewDataSubmission,
    },
  );
};

module.exports = render;
