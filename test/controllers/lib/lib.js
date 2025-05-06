const test = require('ava');
const {
  parseArgs,
  supplyInputFromDefinitionToQuery,
  eitherSupplyInputOrReject,
} = require('../../../controllers/lib');
const sql = require('mssql');
const Future = require('fluture');
const S = require('../../../utility/sanctuary');
const $ = require('sanctuary-def');

const { mockDeleteQueryDefinition } = require('./mockQueryDefinition');
const createMockRequest = require('./mockSQLQuery');

// supplyInputFromDefinitiontoQuery takes a parsed query definition
// and a new sql request and returns the sql request with the values
// in the parsed definition
test('supplyInputFromDefinitionToQuery', (t) => {
  let mockReqBody = { body: { id: 1 } };
  let parsedDef = parseArgs(mockDeleteQueryDefinition)(mockReqBody);

  let SqlReq = createMockRequest({ iAmAPool: true });

  let result = supplyInputFromDefinitionToQuery(parsedDef)(SqlReq);

  let req = S.fst(result);

  let context = req.getContext();
  t.is(!!context.args.ID, true);
});

// eitherSupplyInputOrReject takes an Either and returns a Future of a request
// or it rejects an error string
test('eitherSupplyInputOrReject', (t) => {
  let mockReqBody = { body: { id: 1 } };
  let parsedDef = parseArgs(mockDeleteQueryDefinition)(mockReqBody);

  let RightDef = S.Right(parsedDef);
  let SqlReq = createMockRequest({ iAmAPool: true });

  let result = eitherSupplyInputOrReject(RightDef)(SqlReq);

  // result is a Future
  t.is(Future.isFuture(result), true);
});
