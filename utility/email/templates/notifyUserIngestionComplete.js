// Template | Notify User Ingestion Complete
const Mustache = require("mustache");
const baseTemplate = require("./base-template");
const { notifyUserIngestionComplete } = require("./partials");

const isProduction = process.env.NODE_ENV === "production";
const domain = isProduction
  ? "https://simonscmap.com"
  : "http://localhost:8080";

const render = ({ datasetName, userName, addressee }) => {
  // mustache.render :: template -> data -> partials -> render
  return Mustache.render(
    baseTemplate,
    {
      datasetName: encodeURI(datasetName),
      messageType: "Notification",
      messageTitle: "New Message from CMAP Admin",
      domain,
      addressee,
    },
    {
      messageBody: notifyUserIngestionComplete,
    }
  );
};

module.exports = render;
