const pools = require('../dbHandlers/dbPools');
const sql = require('mssql');

const initializeLogger = require('../log-service');
const moduleLogger = initializeLogger('utility/directQuery');

// directQuery
// utility function to bootstrap a query to Rainier (not through the data router)
// :: String -> Options{} -> Logger -> [ Error?, Result ]
const directQuery = async (queryString, options = {}, logger = moduleLogger) => {
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  let { description = '' } = options

  let result;
  try {
    result = await request.query(queryString);
  } catch (e) {
    logger.error(`query ${description} failed`, { error: e });
    return [e];
  }

  return [null, result];
}

module.exports = directQuery;
