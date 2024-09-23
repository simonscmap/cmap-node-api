const Future = require("fluture");
const test = require("ava");


// test the future framework for executing multiple futures
// in a way that allows tracking which failed;
// Future.parallel doesn't work for this, because it cancels all when one fails
// so we need coalesce
test("send multiple emails", () => {
  const tagFailure = (payload) => ({ success: false, ...payload });
  const tagSuccess = (payload) => ({ success: true, ...payload });
  const taggedCoalesce = Future.coalesce (tagFailure) (tagSuccess);

  const jobs = [
    Future.resolve ({ userId: 999 }),
    Future.reject ({ userId: 888 }),
  ].map ((f) => taggedCoalesce (f));


    const x = Future.parallel (1) (jobs);
    console.log (x);
    console.log (typeof x);

    x.pipe (Future.fork ((err) => {
        reject (err);
    }) ((result) => {
        if (result.length === 2
            && result[0].success === true
            && result[1].success === false
            && result[0].userId === 999
            && result[1].userId === 888
           ) {
          resolve (result);
        } else {
          reject ('reject');
        }
    }));

  });

});
