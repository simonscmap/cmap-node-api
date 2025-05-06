const test = require('ava');
const cacheAsync = require('../utility/cacheAsync');
const nodeCache = require('../utility/nodeCache');

test('node cache', (t) => {
  let key = 'test';
  let r1 = nodeCache.get(key);
  t.is(r1, undefined);

  nodeCache.set(key, 5);
  let r2 = nodeCache.get(key);
  t.is(r2, 5);

  nodeCache.flushAll();
  let r3 = nodeCache.get(key);
  t.is(r3, undefined);

  nodeCache.flushAll();
});

test('cacheAsync', async (t) => {
  // TEST 1
  // cacheAsync gets result from function that return promise
  let KEY = 'key';
  let job1 = () => Promise.resolve([null, 5]);

  // we're not awaiting this, so its a promise
  let result = await cacheAsync(KEY, job1);

  t.is(result, 5);

  // TEST 2
  // cacheAsync puts resulting value in cache
  nodeCache.flushAll();

  t.is(nodeCache.get(KEY), undefined);
  let job2 = () => Promise.resolve([null, 5]);

  // cache result
  await cacheAsync(KEY, job2);

  let cacheResult1 = nodeCache.get(KEY);
  t.is(cacheResult1, 5);

  // TEST 3
  // cacheAsync returns an error value if there is a cache miss
  nodeCache.flushAll();

  t.is(nodeCache.get(KEY), undefined);

  // the "true" value flags that there is an error
  let job3 = () => Promise.resolve([true, 0]);

  // cache result
  let data = await cacheAsync(KEY, job3);

  let cacheResult2 = nodeCache.get(KEY);

  t.is(cacheResult2, undefined);
  // expect to get the error value for "data"
  t.is(data, 0);
});
