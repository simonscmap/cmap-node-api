// adapted from https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/
const logInit = require("../log-service");
const log = logInit ('exponential-backoff');

const wait = (delayMs) => new Promise((res) => setTimeout (res, delayMs));

const metadata = (depth, timeMs) => ({ attempts: depth, timeElapsed: timeMs });

const expBackoffWithMaxCallDepth = (maxDepth = 5, logProgress = false) => {
  async function callWithRetry(fn, pred, depth = 0, timeStart) {
    if (depth === 0) {
      timeStart = Date.now();
    }
    try {
      if (logProgress) {
        log.info (`exp backoff attempt ${depth}`, null);
      }
      const resp = await fn();
      log.info ('result', resp);
      const result = pred(resp);
      if (result) {
        return [null, result, metadata (depth, Date.now() - timeStart)];
      } else {
        throw new Error('Failed check');
      }
    } catch (e) {
      if (logProgress) {
        log.error(`exp backoff caught error on attempt ${depth}`, { error: e });
      }
      if (depth >= maxDepth) {
        return ['Depth exceeded', null, metadata(depth, Date.now() - timeStart)];
      }

      const duration = 2 ** depth * 100;
      log.trace (`wating ${duration}ms`);
      await wait(duration);

      return await callWithRetry(fn, pred, depth + 1, timeStart);
    }
  }
  return callWithRetry;
};

module.exports = {
  wait,
  expBackoffWithMaxCallDepth,
};
