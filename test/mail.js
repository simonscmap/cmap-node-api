const test = require('ava');
const M = require('../utility/email/sendMail');
const Future = require('fluture');

const X$1 = {
  recipient: 'test@recipient.com',
  subject: 'Test Subject',
  content: 'NT',
};

// mock [../utility/oAuth.js] initialized google api client
const C$1 = {
  init: Future.resolve({
    users: {
      messages: {
        send: (x) => x,
      },
    },
  }),
};

test('assembleMail', (t) => {
  let result = M.assembleMail(X$1.recipient)(X$1.subject)(X$1.content);
  let expected =
    "From: 'me'\r\nTo: test@recipient.com\r\nSubject: Test Subject\r\nContent-Type: text/html; charset='UTF-8'\r\nContent-Transfer-Encoding: base64\r\n\r\nNT";

  t.is(result, expected);
});

test('prepare mail', (t) => {
  let result = M.prepareMail(X$1.recipient)(X$1.subject)(X$1.content);
  let expected =
    'RnJvbTogJ21lJw0KVG86IHRlc3RAcmVjaXBpZW50LmNvbQ0KU3ViamVjdDogVGVzdCBTdWJqZWN0DQpDb250ZW50LVR5cGU6IHRleHQvaHRtbDsgY2hhcnNldD0nVVRGLTgnDQpDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nOiBiYXNlNjQNCg0KTlQ';
  t.is(result, expected);
});

// Test that a properly applied sendMailF returns a future, which is forkable
// NOTE: this function is no longer used; use sendServiceMail instead
// see test/serviceMail.js for example of use
test('sendMail', () => {
  let future = M.sendMailF(C$1.init)(X$1);

  // ava needs a promise to do async testing
  // (a reject or resolve is sufficient, dont need a t.pass())
  // note: promise constructor takes the resolve/reject args in
  // the opposite order as the fork function
  return new Promise((resolve, reject) => {
    Future.fork(reject)(resolve)(future);
  });
});
