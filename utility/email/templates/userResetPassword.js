// User Reset Password
const Mustache = require("mustache");
const baseTemplate = require("./base-template");
const { userResetPassword } = require("./partials");

const isProduction = process.env.NODE_ENV === "production";
const domain = isProduction
  ? "https://simonscmap.com"
  : "http://localhost:8080";

const render = ({ jwt }) => {
  // mustache.render :: template -> data -> partials -> render
  const resetUrl = `${domain}/choosepassword/${jwt}`;
  return Mustache.render(
    baseTemplate,
    {
      messageType: "Action",
      messageTitle: "Reset Password Request",
      addressee: "User",
      url: resetUrl,
    },
    {
      messageBody: userResetPassword,
    }
  );
};

module.exports = render;
