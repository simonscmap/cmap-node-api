// adapted from https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/

const wait = (delayMs) => new Promise((res) => setTimeout (res, delayMs));

const metadata = (depth, timeMs) => ({ attempts: depth, timeElapsed: timeMs });

const expBackoffWithMaxCallDepth = (maxDepth = 5, logProgress = false) => {
  async function callWithRetry(fn, pred, depth = 0, timeStart) {
    if (depth === 0) {
      timeStart = Date.now();
    }
    try {
      if (logProgress) {
        console.log(`exp backoff attempt ${depth}`);
      }
      const resp = await fn();
      console.log (resp);
      const result = pred(resp);
      if (result) {
        return [null, result, metadata(depth, Date.now() - timeStart)];
      } else {
        throw new Error('Failed check');
      }
    } catch (e) {
      if (logProgress) {
        console.log(`exp backoff caught error on attempt ${depth}`);
      }
      if (depth > maxDepth) {
        return ['Depth exceeded', null, metadata(depth, Date.now() - timeStart)];
      }

      const duration = 2 ** depth * 100;
      console.log (`wating ${duration}ms`);
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
