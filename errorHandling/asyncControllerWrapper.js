// Wrapper to catch error in async functions
const initializeLogger = require('../log-service');
const moduleLogger = initializeLogger('async controller wrapper');

module.exports = (controllerFunction) => (req, res, next) => {
  let log = moduleLogger
    .setReqId(req.requestId)
    .addContext(['originalUrl', req.originalUrl]);

  if (req.query) {
    log = log.addContext(['query', req.query]);
  }

  Promise.resolve(controllerFunction(req, res, next)).catch((err) => {
    log.error('error in async controller wrapper', { error: err });
    next(err);
  });
};
