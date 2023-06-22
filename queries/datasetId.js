const pools = require("../dbHandlers/dbPools");
const sql = require("mssql");
const initializeLogger = require("../log-service");
const cacheAsync = require("../utility/cacheAsync");

const log = initializeLogger("queries/datasetId");

const CACHE_KEY_DATASET_LIST = 'mapDatasetNameToId';

// lookup dataset id with shortname
const transformDatasetListToMap = (recordset) => {
  let map = new Map();

  recordset.forEach(({ id, dataset_name }) => {
    let key = dataset_name.toLowerCase();
    let existingEntry = map.get(key);
    if (!existingEntry) {
      map.set(key, id);
    }
  });

  return map;
};

const fetchDatasetList = async () => {
  let pool;
  try {
    // pool = await pools.userReadAndWritePool;
    pool = await pools.dataReadOnlyPool;
  } catch (e) {
    log.error("attempt to connect to pool failed", { error: e });
    return [true, []];
  }

  let request = await new sql.Request(pool);
  let q = 'select id, dataset_name from tblDatasets';
  let result;
  try {
    result = await request.query(q);
    log.trace("success fetching list of dataset ids");
  } catch (e) {
    log.error("error fetching list of datasets", { error: e });
    return [true, []];
  }

  if (result && result.recordset && result.recordset.length) {
    let records = result.recordset;

    let datasetMap = transformDatasetListToMap(records);
    // set results in cache
    return [false, datasetMap];
  } else {
    log.error("error fetching list of datasets: no recordset returned ", {
      result,
    });
    return [true, []];
  }
};

// :: () -> Map ID [serverName]
const fetchDatasetListWithCache = async () =>
  await cacheAsync(
    CACHE_KEY_DATASET_LIST,
    fetchDatasetList,
    { ttl: 60 * 60 } // 1 hour; ttl is given in seconds
  );

const getDatasetId = async (shortname) => {
  let key = shortname.toLowerCase();
  // use a cached map
  let idMap = await fetchDatasetListWithCache();
  return idMap.get(key);
}

module.exports.getDatasetId = getDatasetId;
