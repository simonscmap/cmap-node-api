const { SERVER_NAMES } = require('../constants');

const {
  pickRandomArrayItem,
  mapServerNameToPoolConnection,
} = require('../router/serverPoolMapper');
const initializeLogger = require('../../log-service');
const moduleLogger = initializeLogger('router getPool');

const getPool = async (candidateList = [], serverNameOverride = '') => {
  let pool;
  let selectedServerName;
  let hasError = false;
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
  selectedServerName = pickRandomArrayItem(candidates);

  let remainingCandidates = candidateList.filter(
    (c) => c !== selectedServerName,
  );

  try {
    if (selectedServerName === undefined) {
      log.warn('could not settle pool name, defaulting to rainier', {
        candidateList,
      });
      selectedServerName = SERVER_NAMES.rainier;
      pool = await mapServerNameToPoolConnection(SERVER_NAMES.rainier);
    } else {
      pool = await mapServerNameToPoolConnection(selectedServerName);
    }
  } catch (e) {
    hasError = true;
    log.error('failed to get pool connection', {
      error: e,
      poolName: selectedServerName,
    });
    // Return remaining candidates to trigger retry
    return {
      pool: null,
      selectedServerName,
      hasError,
      remainingCandidates,
    };
  }
  // this mapping will default to rainier

  if (!pool) {
    hasError = true;
    log.error('failed to get pool', { candidateList, serverNameOverride });
  } else {
    log.info('get pool result', {
      candidateList,
      selectedServerName,
    });
  }

  return {
    pool,
    selectedServerName,
    hasError,
    remainingCandidates,
  };
};

module.exports = {
  getPool,
};
