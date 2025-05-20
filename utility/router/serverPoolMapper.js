const pools = require('../../dbHandlers/dbPools');
const { SERVER_NAMES } = require('../constants');
const initLogger = require('../../log-service');
const log = initLogger('router serverPoolMapper');
// :: [ServerCandidate] -> ServerCandidate
// NOTE if an empty array is passed, the function will return undefined
const pickRandomArrayItem = (candidates = []) => {
  let numberOfCandidates = candidates.length;
  let randomIndex = Math.floor(Math.random() * numberOfCandidates);
  return candidates[randomIndex];
};

// NOTE default to rainier
const mapServerNameToPoolConnection = async (name) => {
  switch (name) {
    case SERVER_NAMES.rainier:
      return await pools.rainier;
    case SERVER_NAMES.rossby:
      return await pools.rossby;

    // TEMPORARILY REMOVE MARIANA FOR MAINTENANCE
    // case SERVER_NAMES.mariana:
    //   return await pools.mariana;
    default:
      log.warn(`defaulting to ${SERVER_NAMES.rainier}`, { name });
      return await pools.rainier;
  }
};

module.exports = {
  pickRandomArrayItem,
  mapServerNameToPoolConnection,
};
