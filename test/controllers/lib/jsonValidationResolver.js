const test = require('ava');
// const sql = require("mssql");
// const Future = require("fluture");
const S = require('../../../utility/sanctuary');
const $ = require('sanctuary-def');

let {
  bimap,
  encase,
  pipe,
  gets,
  is,
  map,
  maybeToEither,
  join,
  fromRight,
  fromLeft,
} = S;

// bimap takes 2 functions, a 'left' and 'right' function,
// and will map the appropriate 1 onto the value, according the value's type
// if the value is a Left or a Nothing, the 'left' function is mapped
// and conversely if the value is a Rigt or a Just, it will map the 'right' function

// Problem: the 'body' argument is supposed to be stringified json; it may be present
// on the request body, but it may be invalid json
// The resolver does not have a JSON type at its disposal, so it will first be parsed
// as a Just(String), but then we need to validate that it is valid JSON
// So our function takes a Maybe (String) and needs to produce an Either (String);
// However, a Left could result from either the argument being missing, OR from
// the string being unparsable;

let makeErrorMessage = (e) => {
  if (typeof e === 'object') {
    return `body is invalid json: ${e.message}`;
  } else if (typeof e === 'string') {
    return e;
  } else {
    return 'unexpected error resolving body';
  }
};

let resolver = pipe([
  gets(is($.String))(['body', 'body']),
  // Just (String) | Nothing
  map(encase(JSON.parse)),
  // Just (Right (Object)) | Just (Left (SyntaxError)) | Nothing
  maybeToEither('body is required'),
  // Right (Right (Object)) | Right (Left (SyntaxError)) | Left (msg)
  join,
  // Right (Object) | Left (SyntaxError))| Left (msg)
  bimap(makeErrorMessage)(JSON.stringify),
]);

test('json validation resolver with bimap', (t) => {
  let correctReq = { body: { body: '{"content":"","links":[]}' } };

  let malformedArg = { body: { body: '{"content":"","links":[}' } };
  let missingArg = { body: {} };

  let r1 = resolver(correctReq);
  let r1_ = fromRight('')(r1);

  let r2 = resolver(malformedArg);
  let r2_ = fromLeft('')(r2);

  let r3 = resolver(missingArg);
  let r3_ = fromLeft('')(r3);

  t.is(S.isRight(r1), true);
  t.is(S.isLeft(r2), true);
  t.is(S.isLeft(r3), true);

  t.is(r1_, '{"content":"","links":[]}');
  t.is(r2_, 'body is invalid json: Unexpected token } in JSON at position 23');
  t.is(r3_, 'body is required');
});
