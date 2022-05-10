// Notify User of Receipt of Updated Data Submission
const Mustache = require("mustache");
const baseTemplate = require("./base-template");
const { notifyUserOfReceiptOfUpdatedDataSubmission } = require("./partials");

const isProduction = process.env.NODE_ENV === "production";
const domain = isProduction
  ? "https://simonscmap.com"
  : "http://localhost:8080";

const render = ({ datasetName, user }) => {
  // mustache.render :: template -> data -> partials -> render
  return Mustache.render(
    baseTemplate,
    {
      datasetName: encodeURI(datasetName),
      messageType: "Notification",
      messageTitle: "Updated Data Submission Received",
      addressee: `${user.firstName} ${user.lastName}`,
      domain,
    },
    {
      messageBody: notifyUserOfReceiptOfUpdatedDataSubmission,
    }
  );
};

module.exports = render;
