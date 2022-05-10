// Notify Admin of New Data Submission
const Mustache = require("mustache");
const baseTemplate = require("./base-template");
const { notifyAdminOfDataSubmission } = require("./partials");

const isProduction = process.env.NODE_ENV === "production";
const domain = isProduction
  ? "https://simonscmap.com"
  : "http://localhost:8080";

const render = ({ datasetName, user, submissionType }) => {
  // mustache.render :: template -> data -> partials -> render
  return Mustache.render(
    baseTemplate,
    {
      datasetName: encodeURI(datasetName),
      messageType: "Notification",
      messageTitle: "New Data Submission",
      addressee: "CMAP Admin",
      submitter: `${user.firstName} ${user.lastName}`, // this is the user
      submissionType,
      domain,
    },
    {
      messageBody: notifyAdminOfDataSubmission,
    }
  );
};

module.exports = render;
