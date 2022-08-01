const test = require("ava");
const Future = require("fluture");

// resolved and rejected futures
let rj = Future.reject({ error: "some error" });
let rs = Future.resolve({ pool: "some data" });

// functions that return resolved or rejected promises
// (this simulates the futures exported from dbPools)
let prj = (arg) => Promise.reject(arg);
let prs = (arg) => Promise.resolve(arg);

// function that returns a resolved future
let reqF = (data) => Future.resolve({ pool: data.pool, newKey: "here" });



test("pool can be chained with request creation", () => {
  let mockPool = { iAmAPool: true };

  let futureOfPool = Future.attemptP(() => Promise.resolve(mockPool));

  let mockRequest = (pool) => {
    if (pool.iAmAPool) {
      return Future.resolve({ iHaveAPool: pool.iAmAPool })
    } else {
      return Future.reject();
    }
  }

  let testResult = (result) => {
    if (result.iHaveAPool) {
      return Future.resolve();
    } else {
      return Future.reject();
    }
  }

  return new Promise ((resolve, reject) => {
    futureOfPool
      .pipe(Future.chain (mockRequest))
      .pipe(Future.chain (testResult))
      .pipe(Future.fork (reject) (resolve))
  })
});


// encased promises can be forked

test("encaseP rejected promise", () => {
  // encase a function that returns its arg as a rejected promise
  let encasedRejection = Future.encaseP (prj) ("hi");

  return new Promise((resolve, reject) => {
    // expect the encased rejected promise to reject;
    // thus, resolve the test in the rejection fork of the future
    Future.fork (resolve) (reject) (encasedRejection)
  });
});

test("encaseP resolved promise", () => {
  let encasedResolve = Future.encaseP (prs) ("hi");

  return new Promise((resolve, reject) => {
    // expect the encased resolved promise to resolve;
    // thus, resolve the test in the resolution fork of the future
    Future.fork (reject) (resolve) (encasedResolve);
  });
});


// chaining one future with another

test("chain resolve pool", () => {
  // resolve
  let calculation = Future.chain (reqF) (rs);

  return new Promise((resolve, reject) => {
    // expect a resolved future; resolve test on the resolved fork
    Future.fork (() => reject()) (() => resolve()) (calculation);
  });
});

test("chain reject pool", () => {
  // reject
  let calculation = Future.chain(reqF)(rj);

  return new Promise((resolve, reject) => {
    // expect a rejected Future, thus "resolve" on the rejection fork
    Future.fork (resolve) (reject)  (calculation);
  });
});
