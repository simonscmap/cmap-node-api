const test = require("ava");
const { expBackoffWithMaxCallDepth } = require("../utility/exponentialBackoff");

const mockPollFn = (max = 4) => {
  let count = 0;
  return async function run () {
    if (count < max) {
      count += 1;
      return false;
    } else {
      return true;
    }
  }
}

test("resolves as expected", async (t) => {
  const retry3 = expBackoffWithMaxCallDepth (3, true);
  const mockFn = mockPollFn (2);
  const pred = (x) => Boolean (x);

  const [e, result, metadata] = await retry3 (mockFn, pred);

  t.is(e, null);
  t.is(result, true);
  t.is (metadata.attempts, 2); // should only take 2 iterations for the mockFn to return true
  t.truthy(metadata.timeElapsed);
});

test("fails when max depth exceeded", async (t) => {
  const retry2 = expBackoffWithMaxCallDepth (2, true);
  const mockFn = mockPollFn (3);
  const pred = (x) => Boolean (x);

  const [e, result, metadata] = await retry2 (mockFn, pred);

  t.truthy(e);
  t.is(result, null);
  t.is(metadata.attempts, 2); // the expBackoff should be limited to 2 iterations
  t.truthy(metadata.timeElapsed);
});
