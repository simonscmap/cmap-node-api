/*
   Safe Promise

   Provide a standard, simple, interface between Promises and
   return values using await.

   1. Always return an array
   2. Let the rejection value be the first member of the array, or NULL
   3. Let the resolution value be the secord member of the array


   Safe Promise takes a promise-returning function P, and returns an
   async function that applies any args to P.

 */
const initLogger = require('../log-service');
const moduleLogger = initLogger('utility/safePromise');

const safePromise = (p) => async (...pArgs) => {
  if (typeof p !== 'function') {
    moduleLogger.warn('safePromise was provided an incorrect arg');
    // mimic the return value of a rejection
    return [
      new Error('safePromise expects a promise-returning function')
    ];
  }

  try {
    let result = await p(...pArgs);
    return [null, result];
  } catch (e) {
    return [e]
  }
};

module.exports = safePromise;
