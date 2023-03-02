const { SERVER_NAMES } = require("../constants");

const {
  roundRobin,
  mapServerNameToPoolConnection,
} = require("../router/roundRobin");

const getPool = async (candidateList = [], serverNameOverride = '', forceRainier) => {
  let pool;
  let poolName;
  let error = false;
  // defer logging to the caller, which has requestId context
  // by returning log info as 'errors' and 'messages'
  let errors = [];
  let messages = [];

  // adjust the candidates based on override and forceRainier
  let overrideName = serverNameOverride.toLowerCase();
  let candidates = candidateList.slice(0);

  if (forceRainier) {
    messages.push(['get pool forcing rainier', { serverNameOverride, candidateList }])
    candidates = [SERVER_NAMES.rainier];
  } else if (serverNameOverride) {
    if (SERVER_NAMES[overrideName] && candidateList.includes(overrideName)) {
      messages.push(['server name override in use', { serverNameOverride, candidateList }])
      candidates = [overrideName];
    } else {
      messages.push(['requested server not among candidate servers', { serverNameOverride, candidateList }])
    }
  }

  // NOTE if roundRobin is passed an empty list, it will return `undefined`
  // which will map to a default pool in the subsequent call to `mapServerNameToPoolConnection`
  poolName = roundRobin(candidates);

  if (poolName === undefined) {
    messages.push(['could not settle pool name, defaulting to rainier', { candidateList }])
  }

  // this mapping will default to rainier
  pool = await mapServerNameToPoolConnection(
    poolName || SERVER_NAMES.rainier
  );

  if (!pool) {
    error = true;
    errors.push (['failed to get pool', { candidateList, serverNameOverride, forceRainier }]);
  } else {
    messages.push(['get pool result', { candidateList, poolName }]);
  }

  return {
    pool,
    poolName,
    error,
    errors,
    messages,
  };
};

module.exports = {
  getPool,
};
