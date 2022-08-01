const test = require("ava");
const Future = require("fluture");
const S = require("../../../utility/sanctuary");
// const { parseQueryDefinition, eitherSupplyInputOrReject, executeRequest } = require("../../../controllers/lib");
// const { mockDeleteQueryDefinition } = require("./mockQueryDefinition");
// const createMockRequest = require("./mockSQLQuery");

let { resolve, ap } = Future;

test("applicative future poc", () => {
  // https://github.com/fluture-js/Fluture#ap
  let f = (ap (resolve (2)) (ap (resolve (2)) (resolve (x => y => x + y))))

  return new Promise ((resolve, reject) => {
    Future.fork (reject) (resolve) (f);
  });
})


test("applicative futrue: update rank simulation", () => {
  // simulate update rank

  // Problem: the update query depends on the result of a prior query,
  // so it will be expressed as a future;
  // in order to provide the result of that future to the update query,
  // we can use the applicative 'ap'
  // in order to use 'ap' we need the query function (the 3rd term)
  // to be the same monad as the others, so it is a future as well
  // but the query function *itself* returns a future;
  // so at the end of the applicative you get a future of a future,
  // and need to S.join to un-nest the monadic structure, then it can
  // be forked and run as expected

  // See https://github.com/fluture-js/Fluture#ap

  // See https://github.com/fantasyland/fantasy-land/tree/v4.0.1#ap-method

  // See https://sanctuary.js.org/#join
  let updateQDefFuture = resolve ('qdef future');
  let newWriteRequestFuture = resolve ('write request future').pipe( S.map (x => x.toUpperCase()));

  let runUpdateRank = writeRequest => qdef => resolve (writeRequest + qdef)

  let runF = S.join (ap (newWriteRequestFuture) (ap (updateQDefFuture) (resolve (runUpdateRank))));

  // fork runF and check that the function runUpdateRank correctly produces the sum of the
  // two arguments, including the piped modification of newWriteRequestFuture
  return new Promise ((resolve, reject) => {
    Future.fork (reject) (result => {
      if (result == 'qdef futureWRITE REQUEST FUTURE') {
        resolve ();
      } else {
        reject (result);
      }
    }) (runF);
  });
})
