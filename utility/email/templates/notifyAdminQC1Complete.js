// Template | Notify User QC1 Complete
const Mustache = require("mustache");
const baseTemplate = require("./base-template");
const { notifyAdminQC1Complete } = require("./partials");

const isProduction = process.env.NODE_ENV === "production";
const domain = isProduction
  ? "https://simonscmap.com"
  : "http://localhost:8080";

const render = ({ datasetName, userName }) => {
  // mustache.render :: template -> data -> partials -> render
  return Mustache.render(
    baseTemplate,
    {
      datasetName: encodeURI(datasetName),
      messageType: "Notification",
      messageTitle: "New Data Submission Status",
      addressee: "CMAP Admin",
      domain,
      userName,
    },
    {
      messageBody: notifyAdminQC1Complete,
    }
  );
};

module.exports = render;
