const initializeLogger = require("../log-service");
const log = initializeLogger("queryToDatabaseTarget");
const pools = require("../dbHandlers/dbPools");
const sql = require("mssql");
const cacheAsync = require("./cacheAsync");
const { Parser } = require("node-sql-parser");

const CACHE_KEY_DATASET_SERVERS = "datasetServers";
const CACHE_KEY_DATASET_IDS = "datasetIds";

const parserOptions = {
  database: "transactsql", // a.k.a mssql
};

// HELPERS

/* Transform Dasaset_Servers recordset to Map
 * :: [{Dataset_ID, ServerName}] => Map ID [ServerName]
 * create a Map of dataset servers
 * Maps are optimized for frequent read/writes, and safely use the integer of
 * the dataset ID as a key; see:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
 */
const transformDatasetServersListToMap = (recordset) => {
  let map = new Map();

  recordset.forEach(({ Dataset_ID, Server_Alias }) => {
    let existingEntry = map.get(Dataset_ID);
    if (!existingEntry) {
      map.set(Dataset_ID, [Server_Alias]);
    } else {
      map.set(Dataset_ID, [...existingEntry, Server_Alias]);
    }
  });

  return map;
};

/* Extract table names from AST
 * :: AST -> [TableName]
 * Note that this function will return an empty array if it fails
 */
const extractTableNamesFromAST = (ast) => {
  if (ast && !ast.tableList) {
    return [];
  }
  try {
    let result = ast.tableList
      .map((tableString) => tableString.split("::").slice(-1).join())
      .filter((tableName) => tableName.slice(0, 3) === "tbl");
    return result;
  } catch (e) {
    log.error("error parsing ast", { error: e, ast });
    return [];
  }
};

/* Extract table names from EXEC
 * :: AST -> [TableName]
 * Note that extractTableNamesFromEXEC provides a fallback if no query is
 * provided, in which case it will return an empty array
 */
const extractTableNamesFromEXEC = (query = "") => {
  return query
    .split(" ")
    .map((w) => w.replace(/'|,|\[|\]/gi, "")) // remove all: ' , [ ]
    .filter((w) => w.slice(0, 3) === "tbl"); // return any strings that start with "tbl"
};

// remove sql -- comments, which operate on the rest of the line
const removeSQLDashComments = (query) => {
  let stripDashComment = (line) => {
    let indexOfDash = line.indexOf("--");
    if (indexOfDash === -1) {
      return line;
    } else {
      return line.slice(0, indexOfDash);
    }
  };

  let stringHasLength = (line) => line.length > 0;

  let lines = query.split("\n");
  let linesWithoutDashedComments = lines
    .map(stripDashComment)
    .filter(stringHasLength);

  return linesWithoutDashedComments.join("\n");
};

const removeSQLBlockComments = (query) => {
  while (query.indexOf("/*") > -1) {
    let openCommentIx = query.indexOf("/*");
    let nextCloseIx = query.indexOf("*/", openCommentIx);
    // its safe to mutate this, because a string arg is copied, not passed by reference
    // note, to strip the whole comment we must account for the character length of the "*/"
    // by adding 2 to the index of the closing comment
    query = [query.slice(0, openCommentIx), query.slice(nextCloseIx + 2)].join(
      ""
    );
  }
  return query;
};

// isSproc -- determine if a query is executing a sproc
const isSproc = (query) => {
  let queryWithoutDashedComments = removeSQLDashComments(query);
  let queryWithoutComments = removeSQLBlockComments(queryWithoutDashedComments);
  let containsEXEC = queryWithoutComments.toLowerCase().includes("exec");
  return containsEXEC;
};

/* parse a sql query into an AST
   :: Query -> AST | null
 */
const queryToAST = (query) => {
  const parser = new Parser();
  let result;
  try {
    result = parser.parse(query, parserOptions);
  } catch (e) {
    log.warn("error parsing query", { error: e, query });
    return;
  }
  return result;
};

// CACHED FETCHES

/* fetch locations of each dataset
 * :: () => [Error?, Map ID [serverNames]]
 */
const fetchDatasetLocations = async () => {
  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (e) {
    log.error("attempt to conncet to pool failed", { error: e });
    return [true, []];
  }
  let request = await new sql.Request(pool);
  let query = `SELECT * from [dbo].[tblDataset_Servers]`;
  let result;
  try {
    result = await request.query(query);
    log.trace("success fetching dataset servers");
  } catch (e) {
    log.error("error fetching dataset servers", { error: e });
    return [true, []];
  }

  if (result && result.recordset && result.recordset.length) {
    let records = result.recordset;
    // TODO transform records into useable form

    let datasetMap = transformDatasetServersListToMap(records);
    // set results in cache
    return [false, datasetMap];
  } else {
    log.error("error fetching dataset servers: no recordset returned", {
      result,
    });
    return [true, []];
  }
};

// :: () -> Map ID [serverName]
const fetchDatasetLocationsWithCache = async () =>
  await cacheAsync(CACHE_KEY_DATASET_SERVERS, fetchDatasetLocations);

// :: () -> [Error?, [{ Dataset_ID, Table_Name }]]
const fetchDatasetIds = async () => {
  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (e) {
    log.error("attempt to connect to pool failed", { error: e });
    return [true, []]; // indicate error in return tuple
  }
  let request = await new sql.Request(pool);

  let query = `SELECT DISTINCT Dataset_ID, Table_Name
               FROM tblVariables`;
  let result;
  try {
    result = await request.query(query);
    log.trace("success fetching dataset ids");
  } catch (e) {
    log.error("error fetching dataset ids", { error: e });
    return [true, []];
  }

  if (result && result.recordset && result.recordset.length) {
    return [false, result.recordset];
  } else {
    log.error("error fetching dataset ids: no recordset returned", {
      result,
    });
    return [true, []];
  }
};

// :: () => [{ Dataset_ID, Table_Name }]
const fetchDatasetIdsWithCache = async () =>
  await cacheAsync(CACHE_KEY_DATASET_IDS, fetchDatasetIds);

// ANALYZE QUERY

/* Analyze query and extract names of tables visited by query
 * :: Query -> [TableName]
 * Handle "exec" separately
 * NOTE: parser can handle CTEs, joins, comments
 * see: https://github.com/taozhi8833998/node-sql-parser
 */
const extractTableNamesFromQuery = (query) => {
  if (isSproc(query)) {
    log.trace("query is sproc");
    let tableTerms = extractTableNamesFromEXEC(query);
    if (!tableTerms.length) {
      log.debug("no tables specified in sproc", { query, tableTerms });
    } else {
      log.debug("sproc table names", { tableTerms });
    }
    return tableTerms;
  } else {
    let astResult = queryToAST(query);
    if (astResult && astResult.ast && astResult.ast.from) {
      let tableNames = extractTableNamesFromAST(astResult);
      log.debug("tables names", {
        query,
        ast: astResult,
        tableNames,
        tableList: astResult.tableList,
      });
      return tableNames;
    } else {
      log.error("error parsing query: no resulting ast", { query, astResult });
      return [];
    }
  }
};

/*
 *:: [TableName] -> [{Dataset_ID, Table_Name}] -> Map Id [ServerName] -> [ServerName]
 */
const calculateCandidateTargets = (
  tableNames,
  datasetIds,
  datasetLocations
) => {
  // 0. check args
  if (tableNames.length === 0) {
    log.debug("no table names provided", {
      tableNames,
      datasetIds,
      datasetLocations,
    });
    return [];
  }

  // 1. get ids of tables named in query
  let targetIds = datasetIds
    .filter(({ Table_Name }) => tableNames.includes(Table_Name))
    .map(({ Dataset_ID }) => Dataset_ID);

  // 2. derrive common targets

  // -- for each table's id, look up the array of compatible locations
  let locationCandidatesPerTable = targetIds.map((id) =>
    datasetLocations.get(id)
  );

  let candidates = new Set();

  // -- working from the first table's array, for each compatible server
  // check to see if that server is also compatible for remaining tables (i.e., is present
  // in all compatability arrays)
  // NOTE this iteration will work even if the array contains only one set of candidate server
  // names, i.e., when only one table is visited by the query -- this is ensured by the `slice`
  // returning an empty array if there are no more members of the `locationCandidatesPerTable` array
  locationCandidatesPerTable[0].forEach((serverName) => {
    let serverIsCandidateForAllTables = locationCandidatesPerTable
      .slice(1)
      .every((candidateList) => candidateList.includes(serverName));
    if (serverIsCandidateForAllTables) {
      // add to the Set
      // multiple adds of the same name will be discarded by the Set
      candidates.add(serverName);
    }
  });

  let result = Array.from(candidates);

  log.debug("determine candidate servers", {
    datasetLocations,
    datasetIds,
    tableNames,
    candidates: result,
  });

  return result;
};

// Execute
const run = async (query) => {
  // 1. parse query and get table names
  let tableNames = extractTableNamesFromQuery(query);

  // 2. get dataset ids from table names
  let datasetIds = await fetchDatasetIdsWithCache();

  // 3. look up locations for dataset ids
  let datasetLocations = await fetchDatasetLocationsWithCache();

  // 4. calculate candidate locations
  let candidateLocations = calculateCandidateTargets(
    tableNames,
    datasetIds,
    datasetLocations
  );

  // 4. return candidate query targets
  log.info("distributed data router", { query, candidates: candidateLocations.join(" ") });
  return candidateLocations;
};

module.exports = {
  // helpers:
  extractTableNamesFromAST,
  extractTableNamesFromEXEC,
  extractTableNamesFromQuery,
  queryToAST,
  removeSQLDashComments,
  removeSQLBlockComments,
  isSproc,
  transformDatasetServersListToMap,
  // main decision-making function:
  calculateCandidateTargets,
  // execution:
  getCandidateList: run,
};
