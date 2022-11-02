const { SERVER_NAMES } = require("../constants");

const {
  roundRobin,
  mapServerNameToPoolConnection,
} = require("../router/roundRobin");

const getPool = async (candidateList = [], serverNameOverride) => {
  let pool;
  let poolName;

  if (serverNameOverride) {
    if (SERVER_NAMES[serverNameOverride]) {
      pool = await mapServerNameToPoolConnection(serverNameOverride);
      poolName = SERVER_NAMES[serverNameOverride];
    } else {
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
  }
  return {
    pool,
    poolName,
  };
};

module.exports = {
  getPool,
};
