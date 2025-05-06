const Future = require('fluture');
const test = require('ava');
const { futureTestWithPredicate } = require('./testHelpers');

// test the future framework for executing multiple futures
// in a way that allows tracking which failed;
// Future.parallel doesn't work for this, because it cancels all when one fails
// so we need coalesce
test('send multiple emails', () => {
  const tagFailure = (payload) => ({ success: false, ...payload });
  const tagSuccess = (payload) => ({ success: true, ...payload });
  const taggedCoalesce = Future.coalesce(tagFailure)(tagSuccess);

  const jobs = [
    Future.resolve({ userId: 999 }),
    Future.reject({ userId: 888 }),
  ].map((f) => taggedCoalesce(f));

  const f = Future.parallel(1)(jobs);

  const predicate = (result) => {
    return (
      result.length === 2 &&
      result[0].success === true &&
      result[1].success === false &&
      result[0].userId === 999 &&
      result[1].userId === 888
    );
  };

  return futureTestWithPredicate(f, predicate);
});
