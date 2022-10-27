const pools = require("../../dbHandlers/dbPools");
const sql = require("mssql");
const initializeLogger = require("../../log-service");
const { transformDatasetServersListToMap } = require("./pure");
const cacheAsync = require("../cacheAsync");

const CACHE_KEY_DATASET_SERVERS = "datasetServers";
const CACHE_KEY_DATASET_IDS = "datasetIds";
const CACHE_KEY_DB_TABLES = "dbTables";

const log = initializeLogger("router queries");

/*
   NOTE: if these fetchs fail, they will return an empty Array.
   But, the cacheAsync wrapper will not cache the result, and
   they will attempt the fetch again next time.

   There is no retry behavior.

   Failed fetchs are logged as errors.
*/


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

// Fetch a list of all tables
// Used to check if non-dataset table names extracted from a query are real
const fetchAllTables = async () => {
  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (e) {
    log.error("attempt to connect to pool failed", { error: e });
    return [true, []]; // indicate error in return tuple
  }
  let request = await new sql.Request(pool);

  let query = `SELECT table_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME <> 'sysdiagrams'`;

  let result;
  try {
    result = await request.query(query);
    log.debug("success fetching db tables", { result: result.recordset });
  } catch (e) {
    log.error("error fetching db tables", { error: e });
    return [true, []];
  }

  // returned record set should just be an array of table names
  if (result && result.recordset && result.recordset.length) {
    return [false, result.recordset];
  } else {
    log.error("error fetching db tables: no recordset returned", {
      result,
    });
    return [true, []];
  }
};

const fetchAllTablesWithCache = async () =>
  await cacheAsync(CACHE_KEY_DB_TABLES, fetchAllTables);


module.exports = {
  fetchDatasetIdsWithCache,
  fetchDatasetLocationsWithCache,
  fetchAllTablesWithCache,
};
