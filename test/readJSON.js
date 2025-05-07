const readJSON = require('../utility/readJSON');
const test = require('ava');
const Future = require('fluture');

test('read valid json file', (t) => {
  Future.fork(() => t.fail())(() => t.pass())(
    readJSON('test/fixtures/valid-json.json'),
  );
});

test('handle invalid json file', (t) => {
  Future.fork(() => t.pass())(() => t.fail())(
    readJSON('test/fixtures/invalid-json.json'),
  );
});
