const url = 'https://simonscmap.com';
// const url = 'http://localhost:3000';

const doiHelpURL = 'https://simonscmap.com/datasubmission/guide#faq-doi';
const catalogURL = 'https://simonscmap.com/catalog';

// module.exports.forgotPassword (converted)
// module.exports.confirmEmail (converted)

module.exports.contactUs = ({name, email, message}) => (
  `
  Name: ${name}
  Email: ${email}
  Message:
  ${message}
  `
);

// module.exports.dataSubmissionAdminNotification
// module.exports.dataSubmissionUserNotification
// module.exports.dataSubmissionAdminComment
// module.exports.dataSubmissionUserComment

module.exports.awaitingDOINotification = (datasetName) => (`
  Your submission, ${datasetName} has been approved for ingestion!<br>
  The next step is to obtain and submit a DOI for this data. More information on DOIs is available <a href="${doiHelpURL}}" target="_blank">here</a>.<br><br>
  Once you've obtained a DOI please submit it using the messaging feature on the <a href="${url}/datasubmission/userdashboard?datasetName=${encodeURI(datasetName)}" target="_blank">dashboard</a>.
`);

module.exports.ingestionCompleteNotification = (datasetName) => (`
  Your submission, ${datasetName} has been ingested into the CMAP database!<br>
  You can now view your dataset in the <a href=${catalogURL} target="_blank">Data Catalog</a><br>
  Thank you for contributing to Simons CMAP!
`);

module.exports.qc1CompleteNotification = (datasetName, user) => (`
  ${user.firstName + ' ' + user.lastName} has completed QC1 for the submission, ${datasetName}. This dataset is now ready for QC2.
`);
