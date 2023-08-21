/* Middleware to check query size
   checkQuerySizeMiddleware is the middleware wrapper that handles calling next or next error
   checkQuerySize is the core function that implements necessary requests and decision making
   the remaining functions are helpers
 */
const createLogger = require("../log-service");
const { QUERY_ROW_LIMIT } = require("../utility/constants");
const isGriddedData = require('../controllers/data/identifyDatasetType');
const getGriddedDatasetDepths = require('../controllers/data/fetchDepthsForGriddedDataset');
const reconstructDatasetRowCount = require ('../controllers/data/reconstructDatasetRowCount');
const { extractQueryConstraints } = require('../controllers/data/extractQueryConstraints');
const { calculateSize } = require('../controllers/data/calculateQuerySize');
const { internalRouter } = require ('../utility/router/internal-router');

const getDataset = require('../controllers/catalog/fetchDataset');

// Make routed request to get a count of matching rows for a provided query
// getRowCountForQuery :: Query String -> Request Id -> [ Error?, Result ]
const getRowCountForQuery = async (queryToAnalyze, requestId) => {
  let query = `select count(*) row_count from (${queryToAnalyze}) dont_crash_me`;
  let [countError, countResult] = await internalRouter (query, requestId);

  if (countError) {
    return [countError];
  } else if (Array.isArray(countResult) && countResult.length === 1 && countResult[0].row_count) {
    // cluster result
    return [null, countResult[0].row_count];
  } else if (countResult && Array.isArray(countResult.recordset) && countResult.recordset.length && countResult.recordset[0].row_count) {
    return [null, countResult.recordset[0].row_count];
  } else {
    // unexpected condition
    return ['unexpected result; unable to get row count'];
  }
}

const makeResponders = ({ modifiedQuery, analysis, constraints }) => {
  let baseResponseObj = {
    query: {
      modifiedQuery,
      constraints,
      analysis,
    }
  };

  return {
    allow: (projection, messages) =>
      Object.assign(baseResponseObj, { allow: true, projection, messages }),
    prohibit: (projection, response) =>
      Object.assign(baseResponseObj, { allow: false, projection, response })
  }
};

const makeProjection = (size, provenance) => ({ size, provenance });


const getRows = async (tablename, constraints, query) => {
  // get dataset
  let [fetchError, dataset] = await getDataset({ tablename });
  if (fetchError) {
    return [fetchError];
  }

  let datasetTotalRowCount = dataset.Row_Count || 0;

  // (b) total row count is under threshold, return early
  if (datasetTotalRowCount !== 0 && datasetTotalRowCount < QUERY_ROW_LIMIT) {
    return [null, makeProjection(-datasetTotalRowCount, 'table stats')];
  }

  // (c) dataset is gridded, make calculation
  if (isGriddedData(dataset)) {
    // get depths
    let [depthError, depthsResult] = await getGriddedDatasetDepths(dataset);
    let depths = depthError ? null : depthsResult;

    // get dataset row count, if not provided
    if (!datasetTotalRowCount) {
      let [error, reconstructedRowCount, deltas] = await reconstructDatasetRowCount (dataset, tablename);
      if (error) {
        return [error];
      } else {
        dataset.Row_Count = reconstructedRowCount;
        if (!constraints) {
          // console.log ('constraints', constraints);
        } else {
          constraints.deltas = deltas;
        }
      }
    }

    // calculate size of query
    let [size, messages, datasetSummary] = calculateSize(constraints, dataset, depths);
    // console.log(datasetSummary);
    return [null, makeProjection(size, 'calculation'), messages];
  }

  // (d) dataset is irregular
  // query a count of matching rows and compare to preset limit
  // TODO, estimate this based on one slice
  let [queryError, count] = await getRowCountForQuery(query)
  if (queryError) {
    return [queryError]
  } else {
    return [null, makeProjection(count, 'query')];
  }
};


/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

// Driver for query check
// (1) if no tables were identified, allow query to proceed
// (2) multiple tables were identified, query row count and check against threshold
// (3) Query visits exactly 1 table and therefore 1 dataset
//   (a) get dataset stats: need Row_Count and for gridded datesets, extents for each axis
//   (b) check total row count
//   (c) check if dataset is gridded
//     (i)  get depths
//     (ii) calculate size of query
//     (iii) if calculation is valid, check against threshold, or query for row count
//   (d) fallback to query for row count
const checkQuerySize = async (args, logger) => {
  const {
    modifiedQuery: query,
    matchingTables: {
      matchingDatasetTables
    },
    queryAnalysis: analysis,
  } = args;

  let constraints = extractQueryConstraints (query);


  const { allow, prohibit } = makeResponders ({ modifiedQuery: query, analysis, constraints });

  // (1) no tables were identified
  if (matchingDatasetTables.length === 0) {
    let noTableWarning = 'no matching dataset tables on which to perform size check';
    return allow (null, [noTableWarning]);
  }

  // (2) multiple tables were identified
  if (matchingDatasetTables.length > 1) {
    return allow (null, ['query visits multiple tables; no size projection available']);
  }

  // (3) Query visits exactly 1 table and therefore 1 dataset: proceed to get query row count
  let [error, projection, messages] = await getRows (matchingDatasetTables[0], constraints, query);
  if (messages) {
    logger.info('size calculation messages:', { messages });
  }

  if (error) {
    return prohibit (null, { status: 500, message: 'error determining query size projection'});
  }

  // size check
  if (projection.size < QUERY_ROW_LIMIT) {
    return allow (projection, messages);
  } else {
    return prohibit (projection, { status: 400, message: 'query size too large'});
  }
};

// Middleware to Check Query Size
// NOTE: Assumes prior middleware has performed query analysis
const checkQuerySizeMiddleware = async (req, res, next) => {
  const {
    modifiedQuery: query,
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
    matchingTables,
    queryAnalysis,
  };

  let result = await checkQuerySize (args, log);

  log.info ('result', { ...result.query, ...result.projection, allow: result.allow })

  if (Array.isArray(result.messages)) {
    result.messages.forEach ((message) => log.warn (message, null ))
  }

  return res.json (result);
};


module.exports = checkQuerySizeMiddleware;
