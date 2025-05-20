const { SERVER_NAMES } = require('../constants');

const {
  pickRandomArrayItem,
  mapServerNameToPoolConnection,
} = require('../router/serverPoolMapper');
const initializeLogger = require('../../log-service');
const moduleLogger = initializeLogger('router getPool');

const selectServerName = (candidateList, serverNameOverride) => {
  const overrideName = serverNameOverride.toLowerCase();
  let candidates = candidateList.slice(0).filter((c) => c !== 'cluster');

  if (serverNameOverride) {
    if (SERVER_NAMES[overrideName] && candidateList.includes(overrideName)) {
      moduleLogger.info('server name override in use', {
        serverNameOverride,
        candidateList,
      });
      return overrideName;
    }

    moduleLogger.warn('requested server not among candidate servers', {
      serverNameOverride,
      candidateList,
    });
  }

  const selectedServer = pickRandomArrayItem(candidates);
  return selectedServer || SERVER_NAMES.rainier;
};

const getPool = async (candidateList = [], serverNameOverride = '') => {
  let pool;
  let hasError = false;
  const log = moduleLogger
    .addContext(['candidates', candidateList])
    .addContext(['serverNameOverride', serverNameOverride]);

  const selectedServerName = selectServerName(
    candidateList,
    serverNameOverride,
  );
  const remainingCandidates = candidateList.filter(
    (c) => c !== selectedServerName,
  );

  try {
    pool = await mapServerNameToPoolConnection(selectedServerName);
  } catch (e) {
    hasError = true;
    log.error('failed to get pool connection', {
      error: e,
      selectedServerName,
    });
    return {
      pool: null,
      selectedServerName,
      hasError,
      remainingCandidates,
    };
  }

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
