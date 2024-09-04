// A Future based implementation of direct queries to the backend

const sql = require('mssql');
const Future = require ('fluture');

// ideally the pools module would be inside this directory
const pools = require('../../dbHandlers/dbPools');

const initializeLogger = require('../log-service');
const log = initializeLogger('utility/query/direct');

const { map, chain, attemptP, bimap } = Future;


const logRejection = (opt) => (qs) => (response) => {
  log.error (`error executing query`, {
    description: opt.description,
    query: qs,
    response
  });
  return response;
}

const logSuccess = (opt) => (qs) => (response) => {
  log.info (`success executing query`, {
    description: opt.description,
    query: qs,
    response
  });
  return response;
}


// pools.futures should be a function that return an attemptP
// or a Future.reject if there is no pool by that name
const futurePool = (poolName) => pools.futures[poolName];

// given a query string and options,
// 1. get the named pool
// 2. create a new request
// 3. execute request
// 4. log fail/success
// 5. return Future of result


// we can use sanctuary to define directQuery
// options would be a record type requiring a description and poolName
// poolName itself would be an enum of available pool names
// queryString would be a String type
const directQuery = (options) => (queryString) =>
  futurePool (options.poolName)
      .pipe (map ((poolConnection) => new sql.Request (poolConnection)))
      .pipe (chain ((request) => attemptP (request.query (queryString))))
      .pipe (chain (bimap
                    (logRejection (options) (queryString))
                    (logSuccess (options) (queryString))
                   ));

module.exports = directQuery;
