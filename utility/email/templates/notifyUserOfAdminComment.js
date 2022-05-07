// Admin Comment Template
const Mustache = require("mustache");
const baseTemplate = require("./base-template");
const { notifyUserOfAdminComment } = require("./partials");

const isProduction = process.env.NODE_ENV === "production";
const domain = isProduction
  ? "https://simonscmap.com"
  : "http://localhost:8080";

// This template constitutes the notification sent to the user of
// a data submission when an admin has added a comment to the submission

const render = ({ datasetName, userMessage, userName, addressee }) => {
  // note "userName" indicates the user of the web tool; in this case the admin
  // mustache.render :: template -> data -> partials -> render
  return Mustache.render(
    baseTemplate,
    {
      datasetName: encodeURI(datasetName),
      userMessage: userMessage.split("\n"),
      messageType: "Notification",
      messageTitle: "New Message from CMAP Admin",
      domain,
      addressee,
      commentor: userName, // this is the CMAP admin who made the comment
    },
    {
      messageBody: notifyUserOfAdminComment,
    }
  );
};

module.exports = render;
