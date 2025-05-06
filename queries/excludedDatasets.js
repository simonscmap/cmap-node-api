const pools = require('../dbHandlers/dbPools');
const sql = require('mssql');
const initializeLogger = require('../log-service');
const cacheAsync = require('../utility/cacheAsync');
const { safePath } = require('../utility/objectUtils');

const moduleLogger = initializeLogger('queries/excludedDatasets');

const CACHE_KEY_EXCLUDED_DATASETS = 'excludedDatasets';

const responseHasResult = (resp) => {
  const data = safePath(['recordset'])(resp);
  if (data && data.length) {
    return true;
  } else {
    return false;
  }
};

/* NOTE: this query always reads from 'dataReadOnlyPool'
 * which traces back to Rainier 128.208.239.16
 * that means that if the calling routine needs a server-local id
 * for a different server, there could be a mismatch
 */
const fetchExcludedDatasets = async (log = moduleLogger) => {
  let pool;
  try {
    pool = await pools.dataReadOnlyPool;
  } catch (e) {
    log.error('attempt to connect to pool failed', { error: e });
    return [true, []];
  }

  let request = new sql.Request(pool);
  let q = 'select * from tblDatasets_Exclude';
  let result;
  try {
    result = await request.query(q);
    log.trace('success fetching list of excluded datasets');
  } catch (e) {
    log.error('error fetching excluded datasets', { error: e });
    return [true, []];
  }

  if (responseHasResult(result)) {
    const excludedDatasets = result.recordset.map(
      (record) => record.Dataset_Name,
    );
    return [false, excludedDatasets];
  } else {
    log.error('error fetching excluded datasets: none returned', {
      result,
    });
    return [true, []];
  }
};

// :: () ->[excludedDataset]
const fetchExcludedDatasetsWithCache = async () =>
  await cacheAsync(
    CACHE_KEY_EXCLUDED_DATASETS,
    fetchExcludedDatasets,
    { ttl: 60 * 60 }, // 1 hour; ttl is given in seconds
  );

const getExcludedDatasets = async (log = moduleLogger) => {
  const result = await fetchExcludedDatasetsWithCache();
  log.debug('excluded datasets result', result);
  return result;
};

module.exports = getExcludedDatasets;
