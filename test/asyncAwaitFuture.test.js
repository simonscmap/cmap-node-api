const Future = require("fluture");
const test = require("ava");


const mockAsync = async () => {
  return 100;
}

const mockAsyncWithThrow = async () => {
  throw new Error ('oops');
}

const futureOfAnAsync = Future.attemptP (mockAsync);
const futureOfAnAsyncWithThrow = Future.attemptP (mockAsyncWithThrow);


test("use an async function with future", async (t) => {
  return new Promise ((resolve, reject) => {

    const onSuccess = (result) => {
      t.is (result, 100);
      resolve (result);
    };

    const onFailure = (result) => reject (result);

    futureOfAnAsync
      .pipe (Future.fork (onFailure) (onSuccess));

  });
});

test("use a throwing async function with future", () => {
  return new Promise ((resolve, reject) => {

    const onSuccess = (result) => reject (result); // expect failure
    const onFailure = (result) => resolve (result);

    futureOfAnAsyncWithThrow
      .pipe (Future.fork (onFailure) (onSuccess));

  });
});



test("use an async function chaining with a future", async (t) => {
  return new Promise ((resolve, reject) => {

    const onSuccess = (result) => {
      t.is (result, 101);
      resolve (result);
    };

    const onFailure = (result) => reject (result);

    const chainAsync = (input) => Future.attemptP (async () => {
      return input + 1;
    });

    futureOfAnAsync
      .pipe (Future.chain (chainAsync))
      .pipe (Future.fork (onFailure) (onSuccess));

  });
});


test ("use a future with await", async (t) => {
  const x = Future.resolve (10);
  const result = await Future.promise (x);
  t.is (result, 10);
});
