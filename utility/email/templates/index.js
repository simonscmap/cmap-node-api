const notifyAdminOfUserComment = require('./notifyAdminOfUserComment')
const notifyUserOfAdminComment = require('./notifyUserOfAdminComment')
const notifyAdminOfDataSubmission = require('./notifyAdminOfDataSubmission');
const notifyUserOfReceiptOfNewDataSubmission = require('./notifyUserOfReceiptOfNewDataSubmission');
const notifyUserOfReceiptOfUpdatedDataSubmission = require('./notifyUserOfReceiptOfUpdatedDataSubmission');

const templates = {
  notifyUserOfReceiptOfUpdatedDataSubmission,
  notifyUserOfReceiptOfNewDataSubmission,
  notifyAdminOfDataSubmission,
  notifyAdminOfUserComment,
  notifyUserOfAdminComment
}

module.exports = templates;
