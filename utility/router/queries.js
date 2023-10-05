const pools = require("../../dbHandlers/dbPools");
const sql = require("mssql");
const initializeLogger = require("../../log-service");
const { transformDatasetServersListToMap } = require("./pure");
const cacheAsync = require("../cacheAsync");

const CACHE_KEY_DATASET_SERVERS = "datasetServers";
const CACHE_KEY_DATASET_IDS = "datasetIds";
const CACHE_KEY_DB_TABLES = "dbTables";
const CACHE_KEY_USP_DATA = "uspData";

const log = initializeLogger("router queries");

/*
   NOTE: if these fetches fail, they will return an empty Array.
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
    log.error("attempt to connect to pool failed", { error: e });
    return [true, []];
  }
  let request = await new sql.Request(pool);
  let query = `SELECT * from [dbo].[tblDataset_Servers]`;
  let result;
  try {
    result = await request.query(query);
    // log.trace("success fetching dataset servers");
  } catch (e) {
    log.error("error fetching dataset servers", { error: e });
    return [true, []];
  }

  if (result && result.recordset && result.recordset.length) {
    let records = result.recordset;

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
  await cacheAsync(
    CACHE_KEY_DATASET_SERVERS,
    fetchDatasetLocations,
    { ttl: 60 * 60 } // 1 hour; ttl is given in seconds
  );

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
    // log.trace("success fetching dataset ids");
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
  await cacheAsync(
    CACHE_KEY_DATASET_IDS,
    fetchDatasetIds,
    { ttl: 60 * 60 } // 1 hour; ttl is given in seconds
);

// Fetch a list of all tables
// Used to check if non-dataset table names extracted from a query are real
// CAVEAT: this does not return any tables on clusters
const fetchAllOnPremTables = async () => {
  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (e) {
    log.error("attempt to connect to pool failed", { error: e });
    return [true, []]; // indicate error in return tuple
  }
  let request = await new sql.Request(pool);

  let query = `SELECT Table_Name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME <> 'sysdiagrams'`;

  let result;
  try {
    result = await request.query(query);
    // log.debug("success fetching db tables", { result: result.recordset });
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

const fetchAllOnPremTablesWithCache = async () =>
  await cacheAsync(
    CACHE_KEY_DB_TABLES,
    fetchAllOnPremTables,
    { ttl: 60 * 60 } // 1 hour; ttl is given in seconds
  );

/*
   fetch list of data-retrieving stored procedure names
   to assist in distinguishing betweeen sprocs we should let
   run on-prem versus ones that we should get a select statment
   version no run through the request router
   :: () => [error?, data]
*/
const fetchDataRetrievalProcedureNames = async () => {
  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (e) {
    log.error("attempt to connect to pool failed",
              { error: e, in: 'fetchDataRetrievalProcedureNames' });
    return [true, null]; // indicate error in return tuple
  }

  let request = await new sql.Request(pool);

  let query = `SELECT * FROM tblApi_USP_Data`;

  let result;
  try {
    result = await request.query(query);
    // log.debug("success fetching usp list", { result: result.recordset });
  } catch (e) {
    log.error("error fetching usp list", { error: e });
    return [true, null];
  }

  if (result && result.recordset && result.recordset.length) {
    // log.trace ('success fetching usp data', { result: result.recordset });
    let nameList = result.recordset.map (({ USP_Name }) => USP_Name.trim() );
    return [false, nameList];
  } else {
    log.error("error fetching usp list: no recordset returned", {
      result,
    });
    return [true, null];
  }
};

const fetchDataRetrievalProcedureNamesWithCache = async () =>
  await cacheAsync(
    CACHE_KEY_USP_DATA,
    fetchDataRetrievalProcedureNames,
    { ttl: 60 * 60 } // 1 hour; ttl is given in seconds
  );



module.exports = {
  fetchDatasetIdsWithCache,
  fetchDatasetLocationsWithCache,
  fetchAllOnPremTablesWithCache,
  // for use in controllers/data customQuery:
  fetchDataRetrievalProcedureNamesWithCache,
};
