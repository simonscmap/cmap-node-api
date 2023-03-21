const initializeLogger = require("../log-service");
const nodeCache = require("../utility/nodeCache");

const log = initializeLogger("cacheAsync");

// given a cache key and an async function,
// manage checking the cache &/or running the async job
// to return a value

// NOTE the job should not throw; in the event of an error
// it should return an error value

const cacheAsync = async (cacheKey, job) => {
  log.trace(`cacheAsync for ${cacheKey}`);
  let cacheResult = nodeCache.get(cacheKey);

  if (cacheResult) {
    log.trace(`cache hit for ${cacheKey}`);
    return cacheResult;
  }

  // the first value should be null if there is no error
  // if the first value is true, it will indicate
  // that data is a fallback value
  let [error, data] = await job();

  if (error) {
    log.trace(`error in cacheAsync while running job`, { error });
    return data; // let job determine what to return, even when there is an error
  }

  log.trace(`success running job in cacheAsync for ${cacheKey}`);
  nodeCache.set(cacheKey, data);
  return data;
};

module.exports = cacheAsync;
