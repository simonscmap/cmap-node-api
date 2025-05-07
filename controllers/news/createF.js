const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const Future = require('fluture');
const $ = require('sanctuary-def');
const S = require('../../utility/sanctuary');
const {
  // trace,
  parseError,
  parseQueryDefinition,
  pairRequestWithQDef,
  executeRequest,
  eitherSupplyInputOrReject,
} = require('../lib');
const createStoryQDef = require('./queryDefinitions/createStory');
const initializeLogger = require('../../log-service');

let { ap, chain, resolve, reject, fork } = Future;
let { map, join, gets, add, value, is, pipe, head } = S;

let getTopIdDefinition = {
  name: 'Get Top Id',
  // NOTE: since this request has no parameters,
  // we will skip applying parseQueryDefinition,
  // which usually invokes the template function;
  // thus, this template is the final string, rather
  // than a function
  template: `SELECT TOP (1) [ID]
    FROM [Opedia].[dbo].[tblNews]
    ORDER BY ID DESC`,
  args: [],
};

let readPool = pools.futures.dataReadOnlyPool;
let writePool = pools.futures.userReadAndWritePool;

let createRequestWithPool = (pool) => resolve(new sql.Request(pool));
let pairRequestWithGetTopIdQuery = pairRequestWithQDef(getTopIdDefinition);

let parseGetIdResult = (result) => {
  let getIdAndIncrement = pipe([
    gets(is($.Unknown))(['recordset']),
    chain(head),
    chain(value('ID')),
    map(add(1)), // increment to next Int
  ]);

  let maybeId = getIdAndIncrement(result);

  if (S.isJust(maybeId)) {
    let id = S.fromMaybe(-1)(maybeId);
    return resolve(id);
  } else {
    return reject('get top id request did not return a recordset');
  }
};

let prepareCreateDefinition = (reqObject) => (getTopIdResults) => {
  // add the results of the getTopId query as a new key
  // in the object of arguments passed to the updateRank queryDefinition
  let reqContext = reqObject;
  reqContext.topStoryId = getTopIdResults;
  // produce a parsed query definition with the merged arguments
  return parseQueryDefinition(createStoryQDef)(reqContext);
};

// Controller
const createStoryController = (req, res) => {
  let log = initializeLogger('create news story controller');

  log.trace('begin create story');

  // get top id
  let topIdFuture = readPool
    .pipe(chain(createRequestWithPool))
    .pipe(map(pairRequestWithGetTopIdQuery))
    .pipe(chain(executeRequest))
    .pipe(chain(parseGetIdResult));

  // prepare a query definition for the update with the results
  // of the last query
  let createStoryQDefFuture = topIdFuture.pipe(
    map(prepareCreateDefinition(req)),
  );

  // prepare a sql request with the write pool
  let newWriteRequestFuture = writePool.pipe(chain(createRequestWithPool));

  // define the update pipeline
  let runCreateStory = (writeRequest) => (createStoryQDef) =>
    resolve(writeRequest)
      .pipe(chain(eitherSupplyInputOrReject(createStoryQDef)))
      .pipe(chain(executeRequest));

  // provide the futures of the query definition and the new sql request
  // as arguments to the update pipeline via ap;
  // for an explanation of runF, see test/controllers/lib/applicativeFuture
  let runF = join(
    ap(createStoryQDefFuture)(
      ap(newWriteRequestFuture)(resolve(runCreateStory)),
    ),
  );

  // handle success & failure

  let rejectRequest = (error) => {
    let [status, msg] = parseError(error);
    log.error('error creating story', { error: msg });
    res.status(status).send(`Error creating story: ${msg}`);
  };

  let resolveRequest = (result) => {
    log.info('success creating story', { result });
    res.json(result);
  };

  // execute
  fork(rejectRequest)(resolveRequest)(runF);
};

module.exports = createStoryController;
