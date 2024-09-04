// Test helpers
const Future = require("fluture");

const { fork, chain } = Future;

// given a future, fail the test if the future rejects,
// or pass the test if the future resolves
const simpleFutureTest = (f) => {
  return new Promise ((resolveP, rejectP) => {
    f.pipe (fork (rejectP) (resolveP))
  });
}

// given a future and a predicate function that the result
// of the future is appiled to, pass if the predicate returns
// false or if the future rejects; fail if the future rejects or
// the predicate returns false
const futureTestWithPredicate = (f, pred) => {
  return new Promise ((resolveP, rejectP) => {
    f.pipe (chain ((result) => {
      const pass = pred (result);
      if (pass) {
        return Future.resolve (result);
      } else {
        return Future.reject (result);
      }
    }))
      .pipe (fork (rejectP) (resolveP))
  });
}


module.exports = {
  simpleFutureTest,
  futureTestWithPredicate,
};
