const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const Future = require("fluture");
const $ = require("sanctuary-def");
const S = require("../../utility/sanctuary");
const {
  parseError,
  parseQueryDefinition,
  pairRequestWithQDef,
  executeRequest,
  eitherSupplyInputOrReject} = require("../lib");
const updateRankQDef = require("./queryDefinitions/updateRanks");
const initializeLogger = require("../../log-service");


let { ap, chain, resolve, reject, fork } = Future;
let { map, join } = S;

let listRankedItemsDefinition = {
  name: 'List Ranked News Items',
  // NOTE: since this request has no parameters,
  // we will skip applying parseQueryDefinition,
  // which usually invokes the template function;
  // thus this template is the final string, rather
  // than a function
  template: `SELECT [ID], [rank]
    FROM [Opedia].[dbo].[tblNews]
    WHERE rank IS NOT NULL`,
  args: [],
}

let readPool = pools.futures.dataReadOnlyPool;
let writePool = pools.futures.userReadAndWritePool;

let createRequestWithPool = (pool) => resolve (new sql.Request (pool));
let pairRequestWithListQuery = pairRequestWithQDef (listRankedItemsDefinition);

let parseListResult = (result) => {
  let { recordset } = result;
  if (recordset) {
    return resolve(recordset);
  } else {
    return reject('list ranked items query returned no recordset');
  }
}

let prepareUpdateDefinition = (reqObject) => (listResults) => {
  // add the results of the listRankedItems query as a new key
  // in the object of arguments passed to the updateRank queryDefinition
  let reqContext = reqObject;
  reqContext.currentlyRankedItems = listResults;
  // produce a parsed query definition with the merged arguments
  return parseQueryDefinition(updateRankQDef)(reqContext);
}

// Controller
const updateRankController = (req, res) => {
  let log = initializeLogger ('update rank controller');

  log.trace('begin update rank');

  // get currently ranked news items
  let rankedItemsFuture = readPool
    .pipe (chain (createRequestWithPool))
    .pipe (map (pairRequestWithListQuery))
    .pipe (chain (executeRequest))
    .pipe (chain (parseListResult))

  // prepare a query definition for the update with the results
  // of the last query (the rankedItemsFuture)
  let updateQDefFuture = rankedItemsFuture
    .pipe (map (prepareUpdateDefinition (req)))

  // prepare a sql request with the write pool
  let newWriteRequestFuture = writePool
    .pipe (chain (createRequestWithPool))

  // define the update pipeline
  let runUpdateRank = writeRequest => updateRankQDef =>
    resolve(writeRequest)
      .pipe (chain (eitherSupplyInputOrReject (updateRankQDef)))
      .pipe (chain (executeRequest))

  // provide the futures of the query definition and the new sql request
  // as arguments to the update pipeline via ap;
  // for an explanation of runF, see test/controllers/lib/applicativeFuture
  let runF = join (ap (updateQDefFuture)
    (ap (newWriteRequestFuture)
      (resolve (runUpdateRank))))

  // handle success & failure

  let rejectRequest = (error) => {
    let [ status, msg ] = parseError (error);
    log.error('error updating ranks', { error: msg })
    res.status(status).send(`Error updating ranks: ${msg}`);
  }

  let resolveRequest = (result) => {
    log.info('success updating ranks', { result });
    res.json(result);
  }

  // execute
  fork (rejectRequest) (resolveRequest) (runF);
}

module.exports = updateRankController;
