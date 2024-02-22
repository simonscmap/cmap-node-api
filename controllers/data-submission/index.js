const addComment = require("./add-comment");
const beginUploadSession = require('./begin-upload-session');
const checkName = require('./check-name');
const commitUpload = require('./commit-upload');
const deleteSubmission = require('./delete-submission');
const listComments = require('./list-comments');
const listSubmissions = require('./list-submissions');
const listSubmissionsByUser = require('./list-submissions-by-user');
const mostRecentFile = require('./retrieve-most-recent-file');
const uploadFilePart = require('./upload-file-part');
const setSubmissionPhase = require('./set-submission-phase');

module.exports = {
  addComment,
  beginUploadSession,
  checkName: checkName.checkSubmissionName,
  commitUpload,
  deleteSubmission,
  listComments,
  listSubmissions,
  listSubmissionsByUser,
  mostRecentFile,
  setSubmissionPhase,
  uploadFilePart
};
