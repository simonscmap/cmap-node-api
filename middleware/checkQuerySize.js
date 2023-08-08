/* Middleware to check query size
   checkQuerySizeMiddleware is the middleware wrapper that handles calling next or next error
   checkQuerySize is the core function that implements necessary requests and decision making
   the remaining functions are helpers
 */
const createLogger = require("../log-service");
const { QUERY_ROW_LIMIT } = require("../utility/constants");
const isGriddedData = require('../controllers/data/identifyDatasetType');
const { extractQueryConstraints } = require('../controllers/data/extractQueryConstraints');
const { calculateSize } = require('../controllers/data/calculateQuerySize');
const getGriddedDatasetDepths = require('../controllers/data/fetchDepthsForGriddedDataset');
const { internalRouter } = require ('../utility/router/internal-router');

const getDataset = require('../controllers/catalog/fetchDataset');

// Find the Dataset Id among an array of table/id tuples matching a provided table
// getDatasetIdFromTableName :: Table Name -> [ { Table_Name, Dataset_ID } ] -> Null | Dataset ID
const getDatasetIdFromTableName = (tableName, ids) => {
  if (typeof tableName !== 'string' || !Array.isArray(ids)) {
    return null;
  }

  let record = ids.find(({ Table_Name }) => {
    if (Table_Name.toLowerCase() === tableName.toLowerCase()) {
      return true;
    }
    return false;
  });

  if (record) {
    return record.Dataset_ID;
  } else {
    return null;
  }
}

// Make routed request to get a count of matching rows for a provided query
// getRowCountForQuery :: Query String -> Request Id -> [ Error?, Result ]
const getRowCountForQuery = async (queryToAnalyze, requestId) => {
  let query = `select count(*) row_count from (${queryToAnalyze}) dont_crash_me`;
  return await internalRouter (query, requestId);
}

const makeResponsePayload = ({ modifiedQuery, analysis, constraints }) =>
  ({ warnings, response, projection, allow }) => ({
    allow,
    response,
    warnings,
    query: {
      modifiedQuery,
      constraints,
      analysis
    },
    projection
  });

// partially applied helper, with enclosed details, to handle the repeated case where
// a query needs be run to get a count of matching rows, and then return response
const makeGetRowCountAndReturnResponse = (allowQueryFn, prohibitQueryFn, makeProjection) =>
  async (query, requestId) => {
    let [countError, countResult] = await getRowCountForQuery(query, requestId);
    let size = countResult;
    if (Array.isArray(countResult) && countResult.length === 1 && countResult[0].row_count) {
      // cluster result
      size = countResult[0].row_count;
    } else if (countResult && Array.isArray(countResult.recordset) && countResult.recordset.length && countResult.recordset[0].row_count) {
      // on prem result
      size = countResult.recordset[0].row_count;
    } else {
      // unexpected condition
    }
    if (countError || typeof size !== 'number') {
      return prohibitQueryFn(null, null, ['error fetching count for query']);
    } else if (size > QUERY_ROW_LIMIT) {
      return prohibitQueryFn(null, makeProjection(size, 'query'))
    } else { // count is below threshold, allow query
      return allowQueryFn(makeProjection(size, 'query'))
    }
  }

// Driver for query check
// (1) if no tables were identified, allow query to proceed
// (2) multiple tables were identified, query row count and check against threshold
// (3) Query visits exactly 1 table and therefore 1 dataset
//   (a) get dataset stats: need Row_Count and for gridded datesets, extents for each axis
//       - fetch dataset id
//       - use dataset id to fetch dataset stats
//   (b) check total row count
//   (c) check if dataset is gridded
//     (i)  get depths
//     (ii) calculate size of query
//     (iii) if calculation is valid, check against threshold, or query for row count
//   (d) fallback to query for row count
const checkQuerySize = async (args) => {
  const {
    modifiedQuery: query,
    datasetIds,
    matchingTables,
    queryAnalysis: analysis,
    requestId,
  } = args;

  const log = createLogger('middleware/checkQuerySize')
    .setReqId(requestId)
    .addContext(['modifiedQuery', query ]);

  // even though constraints are only used for calculating queries against gridded data,
  // extract it here and include in response
  let constraints = extractQueryConstraints (query);

  // response helpers
  const makeResponse = makeResponsePayload ({ modifiedQuery: query, analysis, constraints });

  const allowQuery = (projection, warnings) =>
    ({ ...makeResponse({ allow: true }), projection, warnings });
  const prohibitQuery = (response, projection, warnings) =>
    ({ ...makeResponse ({ allow: false }), response, projection, warnings });

  const makeProjection = (size, provenance) => ({ size, provenance })

  const getRowCountAndReturnResponse = makeGetRowCountAndReturnResponse (allowQuery, prohibitQuery, makeProjection);

  const { matchingDatasetTables } = matchingTables;

  // (1) no tables were identified
  if (matchingDatasetTables.length === 0) {
    let noTableWarning = 'no matching dataset tables on which to perform size check';
    log.info (noTableWarning, {});
    // allow query to proceed
    return allowQuery (null, [noTableWarning]);

  // (2) multiple tables were identified
  } else if (matchingDatasetTables.length > 1) {
    return getRowCountAndReturnResponse (query, requestId);

  // (3) Query visits exactly 1 table and therefore 1 dataset
  } else {
    let tableName = matchingDatasetTables[0];
    // (a) get dataset stats: need Row_Count and for gridded datesets, extents for each axis
    // get dataset id
    let datasetId = getDatasetIdFromTableName(tableName, datasetIds);
    if (!datasetId) {
      return prohibitQuery({
        status: 500,
        message: `failed to identify dataset by table named in query: ${tableName}`
      },
        null,
        ['error fetching dataset while validating query']
      );
    }

    // use dataset id to get dataset stats
    let [fetchError, dataset] = await getDataset ({ id: datasetId });
    if (fetchError) {
      return prohibitQuery({
        status: 500,
        message: 'failed to fetch dataset named in query'
      },
        null,
        ['error fetching dataset while validating query']
      );
    }

    // Some datasets have null Row_Counts; in these cases, assume dataset is too big to count
    let rowCount = dataset.Row_Count || 0;

    // (b) check total row count
    if (rowCount !== 0 && rowCount < QUERY_ROW_LIMIT) {
      return allowQuery (makeProjection(`Less Than Dataset Total @ ${rowCount}`, 'table stats'));
    // (c) check if dataset is gridded
    } else if (isGriddedData(dataset)) {
      // (i) get depths
      let [depthError, depthsResult] = await getGriddedDatasetDepths (dataset);
      let depths = depthError ? null : depthsResult.map (({ depth }) => depth);
      log.trace ('received depths', depths);
      // (ii) calculate size of query
      let calculatedSize = calculateSize (constraints, dataset, depths, log);
      if (calculatedSize !== 0) {
        if (calculatedSize > QUERY_ROW_LIMIT) {
          return prohibitQuery (null, makeProjection(calculatedSize, 'calculation'));
        } else {
          return allowQuery (makeProjection (calculatedSize, 'calculation'));
        }
      // (iii)
      } else {
        log.trace ('fallback from failed calculation to fetch count for incoming query');
        // one or more constraints are for a single point, but the query size may still be large
        // so as a fallback, get a real count
        return getRowCountAndReturnResponse (query, requestId);
      }
    // (d) dataset is irregular
    } else {
      // query a count of matching rows and compare to preset limit
      return getRowCountAndReturnResponse (query, requestId);
    }
  }
};

// Middleware to Check Query Size
// NOTE: Assumes prior middleware has performed query analysis
// 1. if no tables were identified in query, allow query
// 2. if multiple tables were identified, perform routed query to get a count of matching rows
//    and check against preset limit
// 3. if single table identified (as is the case with most dataset downloads)
//
const checkQuerySizeMiddleware = async (req, res, next) => {
  const {
    modifiedQuery: query,
    datasetIds,
    matchingTables,
    queryAnalysis,
    requestId,
  } = req;

  const log = createLogger('middleware/checkQuerySize')
    .setReqId(requestId)
    .addContext(['modifiedQuery', query ]);

  if (!query) {
    log.warn ('no query on the request object to perform analysis on', {});
    return next();
  }

  let args = {
    modifiedQuery: query,
    datasetIds,
    matchingTables,
    queryAnalysis,
    requestId,
  };

  let result = await checkQuerySize (args);

  log.info ('result', { ...result.query, ...result.projection, allow: result.allow })

  if (Array.isArray(result.warnings)) {
    result.warnings.forEach ((warning) => log.warning (warning, null ))
  }

  let output = req.query.output &&
    typeof req.query.output === 'string' &&
               req.query.output.toLowerCase();

  // if request output is the projection itself, respond
  if (output === 'project_size') {
    // stop further middleware from running, do not call next()
    return res.json (result);
  }

  if (result.allow) {
    next ();
  } else {
    res
      .status(result.response && result.respons.status || 400)
      .send(result.response && result.response.messsage || 'query exceeds maximum size allowed');
    return next (new Error('query failed size check'));
  }
};


module.exports = checkQuerySizeMiddleware;
