const sql = require("mssql");

let S = require("../../utility/sanctuary");
const {
  removeSQLDashComments,
  removeSQLBlockComments,
  removeParensFromTop,
  extractTableNamesFromGrammaticalQueryString,
  compareTableAndDatasetLists,
} = require ("../../utility/router/pure");
const {
  fetchAllOnPremTablesWithCache,
  fetchDatasetIdsWithCache,
  fetchDatasetLocationsWithCache,
} = require ("../../utility/router/queries");
const { mapServerNameToPoolConnection, roundRobin } = require ("../../utility/router/roundRobin");
const cacheAsync = require("../cacheAsync");
const initializeLogger = require("../../log-service");

const CACHE_KEY_TBL_COL_PREFIX = 'tbl_cols_';

const log = initializeLogger("expand download select");

// does a query string have a join
// String -> Boolean
const isJoin =
  S.test (S.regex ('g') ('\\sjoin\\s'))

// is query a 'select *'
// String -> Bool
/* eslint-disable-next-line */
let selectStarRegex = /select\s+(?<top>TOP\s+\d+\s+)?\*\s+from/gim;
let isSelectStar = (str = '') => {
  let result = str.match(selectStarRegex);
  if (result) {
    return true;
  } else {
    return false;
  }
};

// remove comments from sql query string
// String -> String
let stripComments = S.map (removeSQLDashComments)
  (removeSQLBlockComments)

// String -> Boolean
let shouldExpandStar = (queryString) => {
  let q = stripComments (queryString);
  return !isJoin (q) && isSelectStar (q)
}

let replaceStarWithCols = (queryString, cols) => {
  let columnsString = cols
    .map (col => `[${col}]`) // some columns have '+' in them...
    .join(', ');
  let q = stripComments (queryString);

  let replacer = (match, topExpr) => {
    return `select ${topExpr || ''}${columnsString} from`;
  }

  let newQ = q.replace (
    selectStarRegex,
    replacer
  );

  log.info ('replaced select star', { original: q, newQuery: newQ });
  return newQ;
};

// String -> [ TableName ] -> Boolean
const tableIsDatasetTable = (tableName, datasetTables) => {
  return datasetTables
    .map (s => s.toLowerCase())
    .includes (tableName.toLowerCase())
};

const datasetIsOnlyOnCluster = (candidates) => {
  if (candidates.length === 1 && candidates.includes('cluster')) {
    return true;
  } else {
    return false;
  }
}

// return an async job with enclosed args
const fetchColumnNames = (tblName, onPremLocations) => async () => {
  // pick random server from available ones
  let serverName = roundRobin (onPremLocations);
  log.debug (`round robin returned ${serverName}`, { onPremLocations});
  let pool;
  try {
    pool = await mapServerNameToPoolConnection (serverName);
  } catch (e) {
    log.error ("attempt to connect to pool failed", { error: e });
    return [true, []]; // indicate error in return tuple
  }
  let request = await new sql.Request(pool);

  let query = `select
      COLUMN_NAME col_name
    from INFORMATION_SCHEMA.COLUMNS
    where TABLE_NAME='${tblName}'
    and (column_name <>'CSet' and DATA_TYPE <>'xml')`;

  let result;
  try {
    result = await request.query(query);
    log.trace("success fetching dataset columns");
  } catch (e) {
    log.error("error fetching dataset columns", { error: e });
    return [true, []];
  }

  if (result && result.recordset && result.recordset.length) {
    // return a simplified [String] rather than [{ col_name: String }]
    return [false, result.recordset.map (({ col_name }) => col_name )];
  } else {
    log.error("error fetching dataset columns: no recordset returned", {
      result,
    });
    return [true, []];
  }
};

// :: () -> Map ID [serverName]
const fetchColumnNamesWithCache = async (tblName, onPremLocs) =>
  await cacheAsync(
    `${CACHE_KEY_TBL_COL_PREFIX}${tblName}`, // create cache per table name
    fetchColumnNames (tblName, onPremLocs), // enclose args; pass an async thunk to cacheAsync
    { ttl: 60 * 60 * 6 } // 6 hours; ttl is given in seconds
  );

// String -> [ErrorMsg | Null, Altered Query | Null]
let expandStar = async (queryString) => {
  log.trace ('expanding select star expression');
  // get table name

  let tableNames = extractTableNamesFromGrammaticalQueryString (queryString);

  // expecting only one table to be named
  if (tableNames.length === 0) {
    return ['no tables named in query'];
  } else if (tableNames.length > 1) {
    return [`more than one table named in query: ${tableNames.join(', ')}`];
  }

  // check location
  let onPremTableList = await fetchAllOnPremTablesWithCache();
  let datasetIds = await fetchDatasetIdsWithCache();
  let { datasetTables } = compareTableAndDatasetLists (onPremTableList, datasetIds);


  let tableName = tableNames[0];

  if (!tableIsDatasetTable (tableName, datasetTables)) {
    return [`table is not a dataset table: ${tableName}`];
  }

  let datasetLocations = await fetchDatasetLocationsWithCache();

  let datasetRecord = datasetIds
    .find (({ Table_Name }) => Table_Name.toLowerCase() === tableName.toLowerCase());

  if (!datasetRecord) {
    return [`could not match record of dataset table ${tableName} to dataset id`]
  }


  let { Dataset_ID: datasetId } = datasetRecord;

  // loc is an array
  let locs = datasetLocations.get (datasetId);

  log.debug ('locations for table', { tableName, datasetId, locs });

  if (!locs || !Array.isArray(locs) || locs.length === 0) {
    // this could be an indication that the cache is stale, because there should be
    // a location for a valid dataset ID
    return [`no locations for table ${tableName}`];
  } else if (datasetIsOnlyOnCluster (locs)) {
    return [`dataset is only available on cluster`];
  }

  // get column names from on prem dataset
  let onPremLocs = locs.filter ((loc) => loc !== 'cluster');
  let columnNames = await fetchColumnNamesWithCache (tableName, onPremLocs);

  if (columnNames.length === 0) {
    log.debug ('no column names', { datasetId, tableName });
    return ['no column names returned'];
  } else {
    log.info ('retrieved column names for select star', { datasetId, tableName });
    log.debug ('column names', { columnNames });
  }

  let newQueryString = replaceStarWithCols (queryString, columnNames);

  return [null, newQueryString];
}

// if select, fetch columns, then replace * with columns

// else return original query

let expandIfSelectStar = async (queryString) => {
  if (shouldExpandStar (queryString)) {
    return await expandStar (queryString);
  } else {
    return [null, queryString];
  }
};


module.exports = {
  expandStar,
  expandIfSelectStar,
  shouldExpandStar,
  replaceStarWithCols,
}
