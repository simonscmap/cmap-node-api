// Middleware to perform query analysis on incoming query strings
// provides information about which tables are visited in the query
// and information about which tables are "core" tables
// and which are "data" tables
// assigns result to `req.queryAnalysis`

// NOTE: this functionality was extracted from the data router

// each query is cached without expiration
const {
  fetchAllOnPremTablesWithCache,
  fetchDatasetIdsWithCache,
} = require("../utility/router/queries");

// pure functions without side effects,
const {
  compareTableAndDatasetLists,
  filterRealTables,
  extractTableNamesFromQuery,
} = require("../utility/router/pure");

const createLogger = require("../log-service");

// Perform all query analysis, assign to req object,
// and pass to next middleware in the chain
const queryAnalysisMiddleware = async (req, res, next) => {
  const query = req.modifiedQuery;
  const log = createLogger('queryAnalysis middleware');

  if (!query) {
    log.warn ('no query on the request object to perform analysis on');
    return next();
  }

  // 1. parse query and get table names
  let queryAnalysis = extractTableNamesFromQuery(query);
  req.queryAnalysis = queryAnalysis;

  // 2. get list of all tables
  let onPremTableList = await fetchAllOnPremTablesWithCache();

  // 3. get dataset ids from table names
  let datasetIds = await fetchDatasetIdsWithCache();
  req.datasetIds = datasetIds;

  let {
    coreTables,
    datasetTables
  } = compareTableAndDatasetLists(onPremTableList, datasetIds);
  req.coreTables = coreTables;

  // 4. match table names in query to core & data tables
  let matchingTables = filterRealTables(queryAnalysis, coreTables, datasetTables);
  req.matchingTables = matchingTables;

  next();
};


module.exports = queryAnalysisMiddleware ;
