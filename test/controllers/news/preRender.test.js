const test = require('ava');
const preRender = require('../../../controllers/notifications/preRender');

const { preRenderBody } = preRender;

test('preRender', (t) => {
  const body = {
    content:
      'Content with a {0}. <br>A *new /paragraph/ with _nested_ markup!*',
    links: [
      {
        text: 'LINK',
        url: 'http://npr.org',
      },
    ],
  };

  const expected = [
    { text: 'Content with a ' },
    { open: 'a href="http://npr.org"' },
    { text: 'LINK' },
    { close: 'a' },
    { text: '. <br>A ' },
    { open: 'em' },
    { text: 'new ' },
    { open: 'i' },
    { text: 'paragraph' },
    { close: 'i' },
    { text: ' with ' },
    { open: 'u' },
    { text: 'nested' },
    { close: 'u' },
    { text: ' markup!' },
    { close: 'em' },
  ];

  const [error, result] = preRenderBody(body);

  t.is(true, Array.isArray(result));

  t.deepEqual(result, expected);
});
