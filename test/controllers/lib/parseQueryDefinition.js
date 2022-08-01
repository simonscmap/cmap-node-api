const test = require("ava");
const S = require("../../../utility/sanctuary")
const { parseQueryDefinition, parseError } = require("../../../controllers/lib");
const { mockDeleteQueryDefinition, mockMultiArgQuery } = require("./mockQueryDefinition");

// test the parseQueryDefinition against the mockDeleteQueryDefinition
// the parseQueryDefinition takes an unparsed definition and a request body
// and applies the resolvers in the definition to the arguments in the
// request body, mapping them to Either Left (error messages) or
// Right (parsed definition)
test("parseQueryDefinition", (t) => {
  let mockReqBody = {
    body: {
      id: 1,
    },
  };

  let r = parseQueryDefinition (mockDeleteQueryDefinition) (mockReqBody);

  t.is(S.isRight (r), true);
  // todo: confirm value
});


test("parseQueryDefinition: multi-arg, heterogeneous type", (t) => {
  let mockReqBody = {
    body: {
      story: {
        id: 1,
        title: 'title',
        headline: 'headline',
      },
    },
  };

  let r1 = parseQueryDefinition (mockMultiArgQuery) (mockReqBody);
  // expect the return value to be a Right
  t.is(S.isRight (r1), true);

  // test fail case
  let mockReqBody_invalid = {
    body: {
      story: {
        id: 1,
        title: 'title',
        headline: null,
      },
    },
  };

  let r2 = parseQueryDefinition (mockMultiArgQuery) (mockReqBody_invalid);
  // expect the return value to be a Left
  t.is(S.isLeft (r2), true);
  // expect the Left to contain the correct error message: Pair (400) ('headline is required')
  let error = S.fromLeft (S.Pair (0) ('')) (r2);
  let [ status, msg ] = parseError (error);

  t.is(msg, "headline is required")
  t.is(status, 400);
});
