/* preWarmCacheAsync --

   a wrapper for cacheAsync that allows the cache to be
   pre-warmed, and also kept warm
*/

const cacheAsync = require('./cacheAsync');
const nodeCache = require('./nodeCache');
const initializeLogger = require("../log-service");
const log = initializeLogger("preWarmCacheAsync");

const wrapper = async (cacheKey, job, options = {}) => {
  if (nodeCache.get (cacheKey) === undefined) {
    log.info ('warming cache', { cacheKey });
    // pre-warm cache
    try {
      await cacheAsync (cacheKey, job, options);
    } catch (e) {
      log.info ('error warming cache', { cacheKey, error: e });
    }
  } else {
    log.info ('cache already warm', { cacheKey });
  }

  // re-warm upon expiration
  nodeCache.on('expired', (keyOfExpiredCache /* , expiredValue */) => {
    console.log ('cache event: expired');
    if (keyOfExpiredCache === cacheKey) {
      log.info ('re-warming cache', { cacheKey });
      // trigger job & cache result
      cacheAsync (cacheKey, job, options)
        .catch ((e) => {
          log.error ('error re-warming cache', { cacheKey, error: e });
        });
    } else {
      console.log ('expired key did not match', keyOfExpiredCache);
    }
  });

  // return a function that will run the job
  // NOTE that by design, cacheAsync runs jobs
  // whose args cannot be updated with subsequent calls
  // so that it makes the same request each time;
  // returning this function here is for convenience;
  // a separace call to cacheAsync or to nodeCache would work just as well
  // as long as the cacheKey is the same
  const fn = async () =>
    await cacheAsync (cacheKey, job, options);

  return fn;
};

module.exports = wrapper;
