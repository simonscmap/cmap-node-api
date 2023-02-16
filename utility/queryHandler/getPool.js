const { SERVER_NAMES } = require("../constants");
const initLogger = require("../../log-service");

const log = initLogger ('getPool');

const {
  roundRobin,
  mapServerNameToPoolConnection,
} = require("../router/roundRobin");

const getPool = async (candidateList = [], serverNameOverride) => {
  let pool;
  let poolName;

  if (serverNameOverride) {
    log.info ('server name override', { serverNameOverride, candidateList });
    if (SERVER_NAMES[serverNameOverride]) {
      pool = await mapServerNameToPoolConnection(serverNameOverride);
      poolName = SERVER_NAMES[serverNameOverride];
    } else {
      log.error ('failed to look up servername', { serverNameOverride });
      return { error: true };
    }
  } else {
    // NOTE if roundRobin is passed an empty list, it will return `undefined`
    // which will map to a default pool in the subsequent call to `mapServerNameToPoolConnection`

    poolName = roundRobin(candidateList);
    // this mapping will default to rainier
    pool = await mapServerNameToPoolConnection(
      poolName || SERVER_NAMES.rainier
    );
    log.info ('get pool result', { candidateList, poolName });

  }
  return {
    pool,
    poolName,
  };
};

module.exports = {
  getPool,
};
