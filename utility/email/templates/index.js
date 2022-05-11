const notifyAdminOfUserComment = require('./notifyAdminOfUserComment')
const notifyUserOfAdminComment = require('./notifyUserOfAdminComment')
const notifyAdminOfDataSubmission = require('./notifyAdminOfDataSubmission');
const notifyUserOfReceiptOfNewDataSubmission = require('./notifyUserOfReceiptOfNewDataSubmission');
const notifyUserOfReceiptOfUpdatedDataSubmission = require('./notifyUserOfReceiptOfUpdatedDataSubmission');
const userResetPassword = require('./userResetPassword');

const templates = {
  userResetPassword,
  notifyUserOfReceiptOfUpdatedDataSubmission,
  notifyUserOfReceiptOfNewDataSubmission,
  notifyAdminOfDataSubmission,
  notifyAdminOfUserComment,
  notifyUserOfAdminComment
}

module.exports = templates;
