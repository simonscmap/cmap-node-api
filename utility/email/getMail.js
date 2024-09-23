const Future = require("fluture");
const S = require("../sanctuary");
const initializeLogger = require("../../log-service");
const { getGmailClient } = require("../serviceAccountAuth");

const { safePathOr, safePath } = require("../objectUtils");
const messagesOrEmptyArray = safePathOr ([]) (Array.isArray) (['data', 'messages']);


let log = initializeLogger("utility/email/getMail");

// https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list
// 'me' is a special value, indicating to use the authenticated user
// which, in this case, is the one stored in credentials.json

// get mail via a service account with JWT
// depends upon the presence of the key file to
// generate a working gmailClient
const listServiceMail = (args = {}) => {
  log.info("calling user.messages.list", null);

  let gmailClient = getGmailClient();

  return Future.attemptP(() => gmailClient.users.messages.list({
    userId: "me",
    q: args.query || undefined
    // maxResults
    // pageToken
    // labelIds
    // includeSpamTrash
  }));
};


const onTagFailure = (payload) => ({ success: false, ...payload });
const onTagSuccess = (payload) => ({ success: true, ...payload });
const taggedCoalesce = Future.coalesce (onTagFailure) (onTagSuccess);

const bulkGetMail = (listResult) => {
  const messages = messagesOrEmptyArray (listResult);

  console.log ('blkGetMail: messages', listResult)

  const gmailClient = getGmailClient();
  const jobs = messages
        .map(({ id }) => Future.attemptP (() => gmailClient.users.messages.get ({
          userId: 'me',
          id,
          format: 'raw',
        })))
        .map ((f) => taggedCoalesce (f));

  return Future.parallel (5) (jobs);
}

const getServiceMail = (args = {}) => listServiceMail (args)
      .pipe (Future.chain ((result) => {
        if (result.status !== 200) {
          return Future.reject (result)
        } else {
          return bulkGetMail (result);
        }
      }));

module.exports.listServiceMail = listServiceMail;
module.exports.getServiceMail = getServiceMail;
