// General News Notification
const Mustache = require('mustache');
const baseNewsTemplate = require('./base-news-template');
const { generalNewsNotification } = require('./partials');

const isProduction = process.env.NODE_ENV === 'production';
const domain = isProduction
  ? 'https://simonscmap.com'
  : 'http://localhost:8080';

const render = ({ headline, body, tags, emailId }) => {
  // mustache.render :: template -> data -> partials -> render
  return Mustache.render(
    baseNewsTemplate,
    {
      messageTitle: 'Simons CMAP News',
      headline,
      body,
      tags,
      emailId,
    },
    {
      messageBody: generalNewsNotification,
    },
  );
};

module.exports = render;
