const pools = require('../dbHandlers/dbPools');
const sql = require('mssql');

const initializeLogger = require('../log-service');
const moduleLogger = initializeLogger('utility/directQuery');

const removeWhitespaceAndTruncate = (str = '') => {
  if (typeof str !== 'string') {
    return str;
  } else {
    return [str]
      .map((s) => s.replace(/\n/g, ''))
      .map((s) => s.replace(/\s{2,}/g, ' '))
      .map((s) => (s.length > 200 ? s.slice(0, 200) + '...' : s))
      .shift();
  }
};

/* directQuery
 * utility function to bootstrap a query directly,
 * (not through the data router)
 * :: String -> Options{} -> Logger -> [ Error?, Result ]
 */
const directQuery = async (
  queryString,
  options = {},
  logger = moduleLogger,
) => {
  let pool;

  // allow caller to specify pool by name
  if (options.poolName) {
    if (pools[options.poolName]) {
      pool = await pools[options.poolName];
    } else {
      logger.warn(`could not resolve requested pool, using default`, {
        options,
        pools,
      });
      pool = await pools.dataReadOnlyPool;
    }
  } else {
    pool = await pools.dataReadOnlyPool;
  }

  let request = new sql.Request(pool);

  // allow caller to provide a function that sets query input
  if (typeof options.input === 'function') {
    options.input(request);
  }

  let { description = '' } = options;

  let result;
  try {
    logger.trace('exectuing direct query', {
      query: removeWhitespaceAndTruncate(queryString),
    });
    result = await request.query(queryString);
  } catch (e) {
    logger.error(`query ${description} failed`, {
      error: e,
      query: removeWhitespaceAndTruncate(queryString),
    });
    return [e];
  }

  return [null, result];
};

module.exports = directQuery;
