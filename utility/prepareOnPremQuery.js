// Handle the pool creation and request execution for
// a standard on-prem data query
const sql = require('mssql');
// const nodeCache = require("../../utility/nodeCache");
const pools = require('../dbHandlers/dbPools');
const { safePath } = require('./objectUtils');
const logInit = require('../log-service');
const moduleLogger = logInit('controllers/catalog/getProgramDatasets');

// :: queryString -> [error, recordset, fullDbResponse]
const makeDataQuery = async (queryString, reqId, options = {}) => {
  const log = moduleLogger.setReqId(reqId);

  const { poolName, operationName = '' } = options;
  log.trace('TODO: pool name request', { poolName });

  const pool = await pools.dataReadOnlyPool;
  const request = new sql.Request(pool);

  let response;
  try {
    response = await request.query(queryString);
  } catch (e) {
    log.error(`error making ${operationName} query`, {
      queryString,
      error: e,
    });
    return [e];
  }

  const result = safePath(['recordset'])(response);

  return [false, result, response];
};

module.exports = {
  makeDataQuery,
};
