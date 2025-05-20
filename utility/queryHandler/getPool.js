const { SERVER_NAMES } = require('../constants');

const {
  pickRandomArrayItem,
  mapServerNameToPoolConnection,
} = require('../router/serverPoolMapper');

const initializeLogger = require('../../log-service');
const moduleLogger = initializeLogger('router getPool');

const getPool = async (candidateList = [], serverNameOverride = '') => {
  let pool;
  let poolName;
  let error = false;
  const log = moduleLogger
    .addContext(['candidates', candidateList])
    .addContext(['serverNameOverride', serverNameOverride]);

  // adjust the candidates based on override and forceRainier
  let overrideName = serverNameOverride.toLowerCase();

  // remove cluster from candidates
  // however, cluster will be included in remaining candidates list
  let candidates = candidateList.slice(0).filter((c) => c !== 'cluster');

  if (serverNameOverride) {
    if (SERVER_NAMES[overrideName] && candidateList.includes(overrideName)) {
      log.info('server name override in use', {
        serverNameOverride,
        candidateList,
      });
      candidates = [overrideName];
    } else {
      log.warn('requested server not among candidate servers', {
        serverNameOverride,
        candidateList,
      });
    }
  }

  // NOTE if pickRandomItem is passed an empty list, it will return `undefined`
  // which will map to a default pool in the subsequent call to `mapServerNameToPoolConnection`
  poolName = pickRandomArrayItem(candidates);

  let remainingCandidates = candidateList.filter((c) => c !== poolName);

  try {
    if (poolName === undefined) {
      log.warn('could not settle pool name, defaulting to rainier', {
        candidateList,
      });
      poolName = SERVER_NAMES.rainier;
      pool = await mapServerNameToPoolConnection(SERVER_NAMES.rainier);
    } else {
      pool = await mapServerNameToPoolConnection(poolName);
    }
  } catch (e) {
    error = true;
    log.error('failed to get pool connection', { error: e, poolName });
    // Return remaining candidates to trigger retry
    return {
      pool: null,
      poolName,
      error,
      remainingCandidates, // This will trigger the retry mechanism
    };
  }
  // this mapping will default to rainier

  if (!pool) {
    error = true;
    log.error('failed to get pool', { candidateList, serverNameOverride });
  } else {
    log.info('get pool result', { candidateList, poolName });
  }

  return {
    pool,
    poolName,
    error,
    remainingCandidates,
  };
};

module.exports = {
  getPool,
};
