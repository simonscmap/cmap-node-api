const notifyAdminOfUserComment = require('./notifyAdminOfUserComment')
const notifyAdminOfUserContact = require('./notifyAdminOfUserContact')
const notifyUserOfAdminComment = require('./notifyUserOfAdminComment')
const notifyUserAwaitingDOI = require('./notifyUserAwaitingDOI')
const notifyUserIngestionComplete = require('./notifyUserIngestionComplete');
const notifyAdminQC1Complete = require('./notifyAdminQC1Complete')
const notifyAdminOfDataSubmission = require('./notifyAdminOfDataSubmission');
const notifyUserOfReceiptOfNewDataSubmission = require('./notifyUserOfReceiptOfNewDataSubmission');
const notifyUserOfReceiptOfUpdatedDataSubmission = require('./notifyUserOfReceiptOfUpdatedDataSubmission');
const userResetPassword = require('./userResetPassword');
const signupConfirmEmail = require('./signupConfirmEmail');
//
const generalNewsNotification = require('./generalNewsNotification');
const datasetUpdateNotification = require ('./datasetUpdateNotification');


const templates = {
  signupConfirmEmail,
  userResetPassword,
  notifyUserOfReceiptOfUpdatedDataSubmission,
  notifyUserOfReceiptOfNewDataSubmission,
  notifyAdminOfDataSubmission,
  notifyAdminOfUserComment,
  notifyAdminOfUserContact,
  notifyUserOfAdminComment,
  notifyUserAwaitingDOI,
  notifyUserIngestionComplete,
  notifyAdminQC1Complete,
  // news & dataset notifications
  generalNewsNotification,
  datasetUpdateNotification,
}

module.exports = templates;
