const Future = require("fluture");
const S = require("../sanctuary");
const initializeLogger = require("../../log-service");
const { getGmailClient } = require("../serviceAccountAuth");

const { safePathOr, safePath } = require("../objectUtils");

const messagesOrEmptyArray = safePathOr ([]) (Array.isArray) (['data', 'messages']);

const messageData = safePathOr ({}) (x => x && x.id) (['data']);

const { map, chain, parallel, attemptP, coalesce, resolve } = Future;

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
  }))
    .pipe(map (messagesOrEmptyArray)); // get data.messages from response
};

const onTagFailure = (payload) => ({ success: false, ...messageData (payload) });
const onTagSuccess = (payload) => ({ success: true, ...messageData (payload) });
const taggedCoalesce = coalesce (onTagFailure) (onTagSuccess);

const bulkGetMail = (listResult) => {
  log.debug ('fetching bulk mail')
  const gmailClient = getGmailClient();
  const getMessage = ({ id }) =>
        attemptP (() =>
          gmailClient.users.messages.get ({
            userId: 'me',
            id,
          }));

  const jobs = listMessages
        .map(getMessage)
        .map ((f) => taggedCoalesce (f));

  return Future.parallel (5) (jobs);
}

const getMessageThread = (listMessage) => {
  const  { threadId } = listMessage;
  const gmailClient = getGmailClient();
  return attemptP (() =>
    gmailClient.users.threads.get ({ userId: 'me', id: threadId }));
}

const getThreads = (resultOfFetchMessages) =>
      resolve (resultOfFetchMessages) // put result into a Future
      .pipe (map ((messages) => messages.map (getMessageThread))) // turn results into array of jobs
      .pipe (chain (parallel (5))); // execute jobs in parallel

const getServiceMail = (args = {}) =>
      listServiceMail (args)
      .pipe (chain (bulkGetMail));


const getServiceMailThreads = (args = {}) =>
      listServiceMail (args)
        .pipe (chain (getThreads))


module.exports.listServiceMail = listServiceMail;
module.exports.getServiceMail = getServiceMail;
module.exports.getServiceMailThreads = getServiceMailThreads;
