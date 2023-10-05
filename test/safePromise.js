const test = require("ava");
const safePromise = require("../utility/safePromise");

test("handles resolution", async (t) => {
  const p = safePromise(() => new Promise((resolve, reject) => {
    resolve (42);
  }));

  const [err, result] = await p();
  t.is(err, null);
  t.is(result, 42)
});

test("handles rejection", async (t) => {
  const p = safePromise(() => new Promise((resolve, reject) => {
    reject (new Error('mock error'));
  }));

  const [err] = await p();
  t.is(err.message, 'mock error');
});

test("handles thrown error", async (t) => {
  const p = safePromise(() => new Promise((resolve, reject) => {
    throw new Error('mock thrown error')
  }));

  const [err] = await p();
  t.is(err.message, 'mock thrown error');
});

test("correctly applies args", async (t) => {
  const p = safePromise((...args) => new Promise((resolve, reject) => {
    resolve (args.join(' > '))
  }));

  const [err, result] = await p('one', 'two', 'three');
  t.is (err, null);
  t.is(result, 'one > two > three');
});

test("returns safe error when wrong args provided", async (t) => {
  const p = safePromise('moo');

  const [err, result] = await p('one', 'two', 'three');
  t.is(result, undefined);
  t.is (err.message, 'safePromise expects a promise-returning function');
});
