// Notify Admin
const Mustache = require("mustache");
const baseTemplate = require("./base-template");
const { notifyAdmin } = require("./partials");

const isProduction = process.env.NODE_ENV === "production";
const isStaging = process.env.NODE_ENV === "staging"
const domain = isProduction
             ? "https://simonscmap.com"
             : isStaging
             ? "https://simonscmap.dev"
             : "http://localhost:8080";

// This template constitutes the notification sent to CMAP Admin when
// a user has commented on their data submission


const render = ({ title, messageText }) => {
  // mustache.render :: template -> data -> partials -> render
  return Mustache.render(
    baseTemplate,
    {
      messageType: 'Admin Message',
      messageTitle: title,
      messageText,
      addressee: "CMAP Admin",
      domain,
    },
    {
      messageBody: notifyAdmin,
    }
  );
};

module.exports = render;
