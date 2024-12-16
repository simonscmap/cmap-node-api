const pools = require("../dbHandlers/dbPools");
const sql = require("mssql");
const initializeLogger = require("../log-service");
const cacheAsync = require("../utility/cacheAsync");

const moduleLogger = initializeLogger("queries/datasetId");

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

/* NOTE: fetchDataset list always reads from 'dataReadOnlyPool'
 * which traces back to Rainier 128.208.239.16
 * that means that if the calling routine needs a server-local id
 * for a different server, there could be a mismatch
 */
const fetchDatasetList = async (log = moduleLogger) => {
  let pool;
  try {
    pool = await pools.dataReadOnlyPool;
  } catch (e) {
    log.error("attempt to connect to pool failed", { error: e });
    return [true, new Map()];
  }

  let request = new sql.Request(pool);
  let q = 'select id, dataset_name from tblDatasets';
  let result;
  try {
    result = await request.query(q);
    log.trace("success fetching list of dataset ids");
  } catch (e) {
    log.error("error fetching list of datasets", { error: e });
    return [true, new Map()];
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
    return [true, new Map()];
  }
};

// :: () -> Map ID [serverName]
const fetchDatasetListWithCache = async () =>
  await cacheAsync(
    CACHE_KEY_DATASET_LIST,
    fetchDatasetList,
    { ttl: 60 * 60 } // 1 hour; ttl is given in seconds
  );

const getDatasetId = async (shortname, log = moduleLogger) => {
  if (typeof shortname !== 'string') {
    log.error ('received wrong type argument for shortname', { shortname });
    return null;
  }
  let key = shortname.toLowerCase();
  // use a cached map
  let idMap = await fetchDatasetListWithCache();
  const result = idMap.get(key);
  if (result) {
    log.info ('retrieved dataset id', { shortname, result });
  } else {
    log.error('failed to retrieve dataset id', {
      shortname,
      idMapSize: (idMap && idMap.size),
      result,
    });
  }
  return result;
}

module.exports.getDatasetId = getDatasetId;

const getServerLocalDatasetId = (serverName) =>
      async (shortName, log = moduleLogger) => {
        // 1. get correct pool for server
        let pool;
        try {
          pool = await pools[serverName];
        } catch (e) {
          log.error("attempt to connect to pool failed", { error: e });
          return null;
        }
        // 2. get id
        const request = new sql.Request(pool);
        request.input ('shortName', sql.VarChar, shortName);
        const query = 'SELECT id, dataset_name FROM tblDatasets WHERE dataset_name = @shortName';

        // TODO execute query and return result
      };

module.exports.getServerLocalDatasetId = getServerLocalDatasetId;
