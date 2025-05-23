const test = require('ava');
const Future = require('fluture');
const S = require('../../../utility/sanctuary');
const {
  parseQueryDefinition,
  eitherSupplyInputOrReject,
  executeRequest,
} = require('../../../controllers/lib');
const { mockDeleteQueryDefinition } = require('./mockQueryDefinition');
const createMockRequest = require('./mockSQLQuery');
/*
   Test that supplyInputToQuery can be mapped onto a
   future of a sqlrequest in the expected context
   chained context of a controller
 */

let { fst, snd } = S;

test.skip('y', () => {
  let mockReq = createMockRequest();
  let req = Future.attemptP(mockReq.query);

  req.pipe(Future.fork(console.log)(console.log));
});

test.skip('x', () => {
  let mockPool = { iAmAPool: true };
  let futureOfPool = Future.attemptP(() => Promise.resolve(mockPool));
  let mockRequest = (pool) => Future.resolve(createMockRequest(pool));
  let requestBody = { body: { id: 1 } };

  let eitherDefinitionOrError = parseQueryDefinition(mockDeleteQueryDefinition)(
    requestBody,
  );

  let testRequest = (pair) => {
    // test that the value from the mock request body
    // has been correctly provided to this mocked sql request
    let req = fst(pair);
    let def = snd(pair);

    let context = req.getContext();
    let { val } = context.args.ID();
    if (val === requestBody.body.id) {
      if (def.name === mockDeleteQueryDefinition.name) {
        return Future.resolve(req);
      } else {
        return Future.reject('expected def to be provided');
      }
    } else {
      return Future.reject('expected val to be same as mock req body');
    }
  };

  return new Promise((resolve, reject) => {
    futureOfPool
      .pipe(Future.chain(mockRequest))
      .pipe(Future.chain(eitherSupplyInputOrReject(eitherDefinitionOrError)))
      .pipe(Future.chain(testRequest))
      .pipe(Future.fork(reject)(resolve));
  });
});
