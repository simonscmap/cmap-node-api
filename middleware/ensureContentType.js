// middleware to ensure content type is correct

// Note: if an unknown content type is requested by the caller, this middleware will
// have no effect

const createLogger = require('../log-service');

const log = createLogger();

const contentTypes = {
  json: 'json',
};

const mediaTypeLookup = {
  json: 'application/json',
};

const ensureContentType = (t) => {
  let contentType = mediaTypeLookup[t];

  if (!contentType) {
    log.warn('content type lookup failed', { requestedType: t });
  }

  return (req, res, next) => {
    if (contentType && !req.is(contentType)) {
      res.status(400).send('Incorrect content-type.');
      return;
    } else {
      next();
    }
  };
};

module.exports.contentTypes = contentTypes;
module.exports.ensureContentType = ensureContentType;
