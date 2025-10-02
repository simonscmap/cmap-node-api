const createLogger = require('../log-service');

const moduleLogger = createLogger('collectionsValidation');

// Validate collection ID parameter
const validateCollectionId = (id) => {
  if (id === undefined) {
    return { isValid: false, message: 'collection ID is required' };
  }

  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId < 1) {
    return { isValid: false, message: 'collection ID must be a positive integer' };
  }

  return { isValid: true, id: parsedId };
};

// Validate query parameters for collections list endpoint
const validateListQueryParams = (query) => {
  const errors = [];
  const validatedParams = {};

  // Validate limit parameter
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push('limit must be between 1 and 100');
    } else {
      validatedParams.limit = limit;
    }
  } else {
    validatedParams.limit = 20; // Default limit
  }

  // Validate offset parameter
  if (query.offset !== undefined) {
    const offset = parseInt(query.offset, 10);
    if (isNaN(offset) || offset < 0) {
      errors.push('offset must be 0 or greater');
    } else {
      validatedParams.offset = offset;
    }
  } else {
    validatedParams.offset = 0; // Default offset
  }

  // Validate includeDatasets parameter
  if (query.includeDatasets !== undefined) {
    if (query.includeDatasets !== 'true' && query.includeDatasets !== 'false') {
      errors.push('includeDatasets must be "true" or "false"');
    } else {
      validatedParams.includeDatasets = query.includeDatasets === 'true';
    }
  } else {
    validatedParams.includeDatasets = false; // Default value
  }

  return {
    isValid: errors.length === 0,
    errors,
    params: validatedParams
  };
};

// Validate query parameters for collections detail endpoint
const validateDetailQueryParams = (query) => {
  const errors = [];
  const validatedParams = {};

  // Validate includeDatasets parameter (defaults to true for detail endpoint)
  if (query.includeDatasets !== undefined) {
    if (query.includeDatasets !== 'true' && query.includeDatasets !== 'false') {
      errors.push('includeDatasets must be "true" or "false"');
    } else {
      validatedParams.includeDatasets = query.includeDatasets !== 'false';
    }
  } else {
    validatedParams.includeDatasets = true; // Default value for detail endpoint
  }

  return {
    isValid: errors.length === 0,
    errors,
    params: validatedParams
  };
};

// Middleware for validating collections list endpoint
const validateCollectionsList = (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);

  const validation = validateListQueryParams(req.query);

  if (!validation.isValid) {
    log.warn('invalid query parameters for collections list', {
      errors: validation.errors,
      query: req.query
    });
    return res.status(400).json({
      error: 'validation_error',
      message: validation.errors.join(', ')
    });
  }

  // Attach validated parameters to request object
  req.validatedQuery = validation.params;

  log.trace('collections list validation passed', { validatedParams: validation.params });
  next();
};

// Middleware for validating collections detail endpoint
const validateCollectionDetail = (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);

  // Validate collection ID parameter
  const idValidation = validateCollectionId(req.params.id);
  if (!idValidation.isValid) {
    log.warn('invalid collection ID parameter', {
      id: req.params.id,
      error: idValidation.message
    });
    return res.status(404).json({
      error: 'not_found',
      message: 'Collection does not exist'
    });
  }

  // Validate query parameters
  const queryValidation = validateDetailQueryParams(req.query);
  if (!queryValidation.isValid) {
    log.warn('invalid query parameters for collection detail', {
      errors: queryValidation.errors,
      query: req.query
    });
    return res.status(400).json({
      error: 'validation_error',
      message: queryValidation.errors.join(', ')
    });
  }

  // Attach validated parameters to request object
  req.validatedParams = {
    id: idValidation.id
  };
  req.validatedQuery = queryValidation.params;

  log.trace('collection detail validation passed', {
    collectionId: idValidation.id,
    validatedParams: queryValidation.params
  });
  next();
};

module.exports = {
  validateCollectionsList,
  validateCollectionDetail,
  // Export helper functions for testing
  validateCollectionId,
  validateListQueryParams,
  validateDetailQueryParams
};