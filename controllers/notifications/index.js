const history = require('./history');
const send = require('./send');
const reSend = require('./re-send');
const preview = require('./preview');
const recipients = require('./recipients');

module.exports = {
  history,
  send: send.controller,
  reSend,
  preview: preview.controller,
  recipients,
};
