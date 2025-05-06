// User Comment Template
const Mustache = require('mustache');
const baseTemplate = require('./base-template');
const { notifyAdminOfUserComment } = require('./partials');

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const domain = isProduction
  ? 'https://simonscmap.com'
  : isStaging
    ? 'https://simonscmap.dev'
    : 'http://localhost:8080';

// This template constitutes the notification sent to CMAP Admin when
// a user has commented on their data submission

const render = ({ datasetName, userMessage, userName }) => {
  // mustache.render :: template -> data -> partials -> render
  return Mustache.render(
    baseTemplate,
    {
      datasetName: encodeURI(datasetName),
      userMessage: userMessage.split('\n'),
      messageType: 'Notification',
      messageTitle: 'New Message from User',
      addressee: 'CMAP Admin',
      commentor: userName, // this is the user
      domain,
    },
    {
      messageBody: notifyAdminOfUserComment,
    },
  );
};

module.exports = render;
