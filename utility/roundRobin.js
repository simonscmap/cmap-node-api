const pools = require("../dbHandlers/dbPools");
const { SERVER_NAMES } = require("./constants");

// :: [ServerCandidate] -> ServerCandidate
const roundRobin = (candidates) => {
  let numberOfCandidates = candidates.length;
  let randomIndex = Math.floor(Math.random() * numberOfCandidates);
  return candidates[randomIndex];
};

// NOTE for historical reasons, ranier is coded as "dataReadOnlyPool"
// NOTE default to ranier
const mapServerNameToPoolConnection = async (name) => {
  switch (name) {
    case SERVER_NAMES.ranier:
      return await pools.dataReadOnlyPool;
    case SERVER_NAMES.rossby:
      return await pools.rossby;
    case SERVER_NAMES.mariana:
      return await pools.mariana;
    default:
      return await pools.dataReadOnlyPool;
  }
};

module.exports = {
  roundRobin,
  mapServerNameToPoolConnection,
};
