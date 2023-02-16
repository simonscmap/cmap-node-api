const { SERVER_NAMES } = require("../constants");

const {
  roundRobin,
  mapServerNameToPoolConnection,
} = require("../router/roundRobin");

const getPool = async (candidateList = [], serverNameOverride) => {
  let pool;
  let poolName;
  let error = false;
  // defer logging to the caller, which has requestId context
  // by returning log info as 'errors' and 'messages'
  let errors = [];
  let messages = [];

  if (serverNameOverride) {
        messages.push(['server name override', { serverNameOverride, candidateList }])
    if (SERVER_NAMES[serverNameOverride]) {
      pool = await mapServerNameToPoolConnection(serverNameOverride);
      poolName = SERVER_NAMES[serverNameOverride];
    } else {
      // log.error ('failed to look up servername', { serverNameOverride });
      errors.push(['failed to look up servername', { serverNameOverride }]);
      error = true;
    }
  } else {
    // NOTE if roundRobin is passed an empty list, it will return `undefined`
    // which will map to a default pool in the subsequent call to `mapServerNameToPoolConnection`

    poolName = roundRobin(candidateList);
    // this mapping will default to rainier
    pool = await mapServerNameToPoolConnection(
      poolName || SERVER_NAMES.rainier
    );

    // log.info ('get pool result', { candidateList, poolName });
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
