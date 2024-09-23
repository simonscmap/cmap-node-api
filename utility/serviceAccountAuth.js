const { google } = require("googleapis");
const KEY_FILE_PATH = "./utility/googleServiceAccountKeyFile.json";

const generateAuth = () =>
  new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
  });

const generateJWTAuth = () =>
  new google.auth.JWT({
    subject: "no-reply@simonscmap.com",
    keyFile: KEY_FILE_PATH,
    scopes: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.readonly"
    ],
  });

const generateGmailClient = (auth) =>
  google.gmail({ version: "v1", auth });

module.exports = {
  getGmailClient: () => generateGmailClient (generateJWTAuth ()),
};
