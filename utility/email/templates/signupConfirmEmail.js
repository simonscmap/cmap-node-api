// User Reset Password
const Mustache = require('mustache');
const baseTemplate = require('./base-template');
const { signupConfirmEmail } = require('./partials');

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const domain = isProduction
  ? 'https://simonscmap.com'
  : isStaging
    ? 'https://simonscmap.dev'
    : 'http://localhost:8080';

const render = ({ jwt, addressee }) => {
  // mustache.render :: template -> data -> partials -> render
  const choosePasswordURL = `${domain}/choosepassword/${jwt}`;
  return Mustache.render(
    baseTemplate,
    {
      messageType: 'Action',
      messageTitle: 'Choose Account Password',
      addressee,
      url: choosePasswordURL,
    },
    {
      messageBody: signupConfirmEmail,
    },
  );
};

module.exports = render;
