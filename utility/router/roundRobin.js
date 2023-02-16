const pools = require("../../dbHandlers/dbPools");
const { SERVER_NAMES } = require("../constants");
const initLogger = require("../../log-service");
const log = initLogger('roundRobin');
// :: [ServerCandidate] -> ServerCandidate
// NOTE if an empty array is passed, the function will return undefined
const roundRobin = (candidates = []) => {
  let numberOfCandidates = candidates.length;
  let randomIndex = Math.floor(Math.random() * numberOfCandidates);
  return candidates[randomIndex];
};

// NOTE for historical reasons, rainier is coded as "dataReadOnlyPool"
// NOTE default to rainier
const mapServerNameToPoolConnection = async (name) => {
  switch (name) {
    case SERVER_NAMES.rainier:
      return await pools.dataReadOnlyPool;
    case SERVER_NAMES.rossby:
      return await pools.rossby;
    case SERVER_NAMES.mariana:
      return await pools.mariana;
    default:
      log.warn ('defaulting to dataReadOnlyPool', { name });
      return await pools.dataReadOnlyPool;
  }
};

module.exports = {
  roundRobin,
  mapServerNameToPoolConnection,
};
