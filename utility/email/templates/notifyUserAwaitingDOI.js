const Mustache = require("mustache");
const baseTemplate = require("./base-template");
const { notifyUserAwaitingDOI } = require("./partials");

const isProduction = process.env.NODE_ENV === "production";
const domain = isProduction
  ? "https://simonscmap.com"
  : "http://localhost:8080";

// This template constitutes the notification sent to the user of
// of a phase changi in their data submission: now awaiting DOI

const render = ({ datasetName, addressee }) => {
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
      messageBody: notifyUserAwaitingDOI,
    }
  );
};

module.exports = render;
