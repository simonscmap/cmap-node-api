const test = require('ava');
let S = require('../../../utility/sanctuary');

let { mockDeleteQueryDefinition } = require('./mockQueryDefinition');

// the definition for argsAreValid is moved here, out of the controllers/lib
// because it is no longer used; but this test can serve as a record, in case
// it can serve some purpose later
// args -> either valid or error message
let argsAreValid = (parsedArgs) => {
  let pickEitherVals = S.map(S.prop('eitherVal'));
  let concatErrorMessages = S.compose(S.lefts)(pickEitherVals);
  let rightOrLeft = S.ifElse((errors) => errors.length === 0)(S.Right)(S.Left);
  let run = S.compose(rightOrLeft)(concatErrorMessages);
  return run(parsedArgs);
};

// TESTS

test('validate args: success case', (t) => {
  let mockValidReq = {
    body: {
      id: 1,
    },
  };

  let parseArgsWithQueryDef = parseArgs(mockDeleteQueryDefinition);

  let parsedValidReq = parseArgsWithQueryDef(mockValidReq);

  // validation
  let validation = argsAreValid(parsedValidReq.args);

  // validation returns a Right
  t.is(S.isRight(validation), true);

  // parsed arg for id should return a Right
  t.is(S.isRight(parsedValidReq.args[0].eitherVal), true);

  // parsed arg should contain "1"
  t.is(S.fromRight(0)(parsedValidReq.args[0].eitherVal), 1);
});

test('validate args: failure case', (t) => {
  let mockInvalidReq = {
    body: {},
  };

  let parseArgsWithQueryDef = parseArgs(mockDeleteQueryDefinition);

  let parsedInvalidReq = parseArgsWithQueryDef(mockInvalidReq);

  // validation
  let validation = argsAreValid(parsedInvalidReq.args);

  // validation returns a Right
  t.is(S.isLeft(validation), true);

  // expect resolver to return Left
  t.is(S.isLeft(parsedInvalidReq.args[0].eitherVal), true);
});
