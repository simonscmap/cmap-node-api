const sql = require("mssql");
const pools = require("../dbHandlers/dbPools");
const initializeLogger = require("../log-service");
const Future = require("fluture");
const S = require("../utility/sanctuary");
const { eitherSupplyInputOrReject, parseQueryDefinition, executeRequest } = require("./lib");

let { chain } = S;
let { fork } = Future;

// future of a request
let { userReadAndWritePool } = pools.futures;

// create request with pool
let createRequestWithPool = (pool) => Future.resolve(new sql.Request(pool));

// Generate Controller
let generateController = (queryDefinition) => (req, res) => {
  let { name } = queryDefinition;
  const log = initializeLogger(`controller: ${name}`);
  log.trace(`request to: ${name}`, { requestBody: req.body })

  let eitherDefinitionOrError = parseQueryDefinition (queryDefinition) (req);

  let reject = (e) => {
    log.error(`error in ${name}`, { error: e });
    res.status(500).send(`Error in ${name}`);
  }

  let resolve = (queryResponse) => {
    log.info(`success in ${name}`, { result: queryResponse });
    res.status(200).send(queryResponse.recordset);
  }

  // TODO: vary pool based on needs of the query
  userReadAndWritePool
    .pipe(chain (createRequestWithPool))
    .pipe(chain (eitherSupplyInputOrReject (eitherDefinitionOrError)))
    .pipe(chain ((executeRequest)))
    .pipe(fork (reject) (resolve))
}

module.exports.generateController = generateController;
