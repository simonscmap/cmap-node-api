// Wrapper to catch error in async functions
const initializeLogger = require("../log-service");
const log = initializeLogger ("async controller wrapper");

module.exports = controllerFunction => (req, res, next) => {
  log.setReqId(req.requestId);
  if (req.query) {
    log.addContext(['query', req.query]);
  }
  Promise.resolve(controllerFunction(req, res, next)).catch((err) => {
    log.error('error in async controller wrapper', { error: err });
    next(err);
  });
}
