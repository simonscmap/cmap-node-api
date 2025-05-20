const { SERVER_NAMES } = require('../constants');

const {
  pickRandomArrayItem,
  mapServerNameToPoolConnection,
} = require('../router/serverPoolMapper');
const initializeLogger = require('../../log-service');
const log = initializeLogger('router getPool');

const selectServerName = (candidateList, serverNameOverride) => {
  const overrideName = serverNameOverride.toLowerCase();
  let candidates = candidateList.slice(0).filter((c) => c !== 'cluster');

  if (serverNameOverride) {
    if (SERVER_NAMES[overrideName] && candidateList.includes(overrideName)) {
      log.info('server name override in use', {
        serverNameOverride,
        candidateList,
      });
      return overrideName;
    }

    log.warn('requested server not among candidate servers', {
      serverNameOverride,
      candidateList,
    });
  }

  const selectedServer = pickRandomArrayItem(candidates);
  return selectedServer || SERVER_NAMES.rainier;
};

const connectToPool = async (serverName, log) => {
  try {
    const pool = await mapServerNameToPoolConnection(serverName);
    if (!pool) {
      log.error('failed to get pool', { serverName });
      return { success: false, pool: null };
    }
    return { success: true, pool };
  } catch (error) {
    log.error('failed to get pool connection', {
      error,
      serverName,
    });
    return { success: false, pool: null };
  }
};

const getPool = async (candidateList = [], serverNameOverride = '') => {
  const selectedServerName = selectServerName(
    candidateList,
    serverNameOverride,
  );
  const remainingCandidates = candidateList.filter(
    (c) => c !== selectedServerName,
  );

  const { success, pool } = await connectToPool(selectedServerName, log);

  if (success) {
    log.info('get pool result', {
      candidateList,
      selectedServerName,
    });
  }

  return {
    pool,
    selectedServerName,
    hasError: !success,
    remainingCandidates,
  };
};

module.exports = {
  getPool,
};
