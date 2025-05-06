// Contact Us Template
const Mustache = require('mustache');
const baseTemplate = require('./base-template');
const { notifyAdminOfUserContact } = require('./partials');

// This template constitutes the notification sent to CMAP Admin when
// a user has sent a note via the "Contact Us" form

const render = ({ name, email, message }) => {
  // mustache.render :: template -> data -> partials -> render
  return Mustache.render(
    baseTemplate,
    {
      name,
      email,
      message: message.split('\n'),
      messageType: 'Notification',
      messageTitle: 'New Message from User',
      addressee: 'CMAP Admin',
    },
    {
      messageBody: notifyAdminOfUserContact,
    },
  );
};

module.exports = render;
