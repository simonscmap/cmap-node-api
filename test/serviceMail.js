const test = require('ava');
const Future = require('fluture');
const { getGmailClient } = require('../utility/serviceAccountAuth');
const { prepareMail } = require('../utility/email/sendMail');
const { google } = require('googleapis');

let mockGetGmailClientFailure = () => {
  let auth = new google.auth.JWT({
    subject: 'no-reply@simonscmap.com',
    keyFile: 'NOTHING TO SEE HERE',
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
  });
  return google.gmail({ version: 'v1', auth });
};

test('generates gmail client', (t) => {
  let gmailClient = getGmailClient();
  t.truthy(gmailClient);
});

test('service mail example', (t) => {
  // dont execute this test, just leave it for reference

  t.pass();

  /* let raw = prepareMail("walker@anthanes.com")("test service client")(
*   "body content"
* );

* let gmailClient = getGmailClient();

* let send = () =>
*   gmailClient.users.messages.send({
*     userId: "me",
*     resource: { raw },
*   });

* let sendF = Future.attemptP(send);

* // ava needs a promise to do async testing
* // (a reject or resolve is sufficient, dont need a t.pass())
* // note: promise constructor takes the resolve/reject args in
* // the opposite order as the fork function
* return new Promise((resolve, reject) => {
*   Future.fork(reject)(resolve)(sendF);
* }); */
});

test('service mail rejects throw', () => {
  let raw = prepareMail('walker@anthanes.com')('test service client')(
    'body content',
  );

  let gmailClient = mockGetGmailClientFailure();

  let send = () =>
    gmailClient.users.messages.send({
      userId: 'me',
      resource: { raw },
    });

  let sendF = Future.attemptP(send);

  return new Promise((resolve, reject) => {
    // expect this to reject
    Future.fork(resolve)(reject)(sendF);
  });
});
