const { SERVER_NAMES } = require('../constants');

const {
  roundRobin,
  mapServerNameToPoolConnection,
} = require('../router/roundRobin');

const getPool = async (candidateList = [], serverNameOverride = '') => {
  let pool;
  let poolName;
  let error = false;
  // defer logging to the caller, which has requestId context
  // by returning log info as 'errors' and 'messages'
  let errors = [];
  let messages = [];

  // adjust the candidates based on override and forceRainier
  let overrideName = serverNameOverride.toLowerCase();

  // remove cluster from candidates
  // however, cluster will be included in remaining candidates list
  let candidates = candidateList.slice(0).filter((c) => c !== 'cluster');

  if (serverNameOverride) {
    if (SERVER_NAMES[overrideName] && candidateList.includes(overrideName)) {
      messages.push([
        'server name override in use',
        { serverNameOverride, candidateList },
      ]);
      candidates = [overrideName];
    } else {
      messages.push([
        'requested server not among candidate servers',
        { serverNameOverride, candidateList },
      ]);
    }
  }

  // NOTE if roundRobin is passed an empty list, it will return `undefined`
  // which will map to a default pool in the subsequent call to `mapServerNameToPoolConnection`
  poolName = roundRobin(candidates);

  let remainingCandidates = candidateList.filter((c) => c !== poolName);

  try {
    if (poolName === undefined) {
      messages.push([
        'could not settle pool name, defaulting to rainier',
        { candidateList },
      ]);
      poolName = SERVER_NAMES.rainier;
      pool = await mapServerNameToPoolConnection(SERVER_NAMES.rainier);
    } else {
      pool = await mapServerNameToPoolConnection(poolName);
    }
  } catch (e) {
    error = true;
    errors.push(['failed to get pool connection', { error: e, poolName }]);
    // Return remaining candidates to trigger retry
    return {
      pool: null,
      poolName,
      error: true,
      errors,
      messages,
      remainingCandidates, // This will trigger the retry mechanism
    };
  }
  // this mapping will default to rainier

  if (!pool) {
    error = true;
    errors.push(['failed to get pool', { candidateList, serverNameOverride }]);
  } else {
    messages.push(['get pool result', { candidateList, poolName }]);
  }

  return {
    pool,
    poolName,
    error,
    errors,
    messages,
    remainingCandidates,
  };
};

module.exports = {
  getPool,
};
