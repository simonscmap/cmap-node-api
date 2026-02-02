const createLogger = require('../log-service');

const moduleLogger = createLogger('collectionsValidation');

// Validate collection ID parameter
const validateCollectionId = (id) => {
  if (id === undefined) {
    return { isValid: false, message: 'collection ID is required' };
  }

  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId < 1) {
    return {
      isValid: false,
      message: 'collection ID must be a positive integer',
    };
  }

  return { isValid: true, id: parsedId };
};

// Validate query parameters for collections list endpoint
const validateListQueryParams = (query) => {
  const errors = [];
  const validatedParams = {};

  // TODO: Re-enable when implementing backend pagination
  // Currently using frontend pagination - fetching all collections
  //
  // // Validate limit parameter
  // if (query.limit !== undefined) {
  //   const limit = parseInt(query.limit, 10);
  //   if (isNaN(limit) || limit < 1 || limit > 100) {
  //     errors.push('limit must be between 1 and 100');
  //   } else {
  //     validatedParams.limit = limit;
  //   }
  // } else {
  //   validatedParams.limit = 20; // Default limit
  // }

  // // Validate offset parameter
  // if (query.offset !== undefined) {
  //   const offset = parseInt(query.offset, 10);
  //   if (isNaN(offset) || offset < 0) {
  //     errors.push('offset must be 0 or greater');
  //   } else {
  //     validatedParams.offset = offset;
  //   }
  // } else {
  //   validatedParams.offset = 0; // Default offset
  // }

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
    params: validatedParams,
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
    params: validatedParams,
  };
};

// Middleware for validating collections list endpoint
const validateCollectionsList = (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);

  const validation = validateListQueryParams(req.query);

  if (!validation.isValid) {
    log.warn('invalid query parameters for collections list', {
      errors: validation.errors,
      query: req.query,
    });
    return res.status(400).json({
      error: 'validation_error',
      message: validation.errors.join(', '),
    });
  }

  // Attach validated parameters to request object
  req.validatedQuery = validation.params;

  log.trace('collections list validation passed', {
    validatedParams: validation.params,
  });
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
      error: idValidation.message,
    });
    return res.status(404).json({
      error: 'not_found',
      message: 'Collection does not exist',
    });
  }

  // Validate query parameters
  const queryValidation = validateDetailQueryParams(req.query);
  if (!queryValidation.isValid) {
    log.warn('invalid query parameters for collection detail', {
      errors: queryValidation.errors,
      query: req.query,
    });
    return res.status(400).json({
      error: 'validation_error',
      message: queryValidation.errors.join(', '),
    });
  }

  // Attach validated parameters to request object
  req.validatedParams = {
    id: idValidation.id,
  };
  req.validatedQuery = queryValidation.params;

  log.trace('collection detail validation passed', {
    collectionId: idValidation.id,
    validatedParams: queryValidation.params,
  });
  next();
};

// Middleware for validating collection name availability check
const validateCollectionNameCheck = (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);

  const name = req.query.name;

  if (!name) {
    log.warn('missing collection name parameter');
    return res.status(400).json({
      error: 'validation_error',
      message: 'name parameter is required',
    });
  }

  if (typeof name !== 'string') {
    log.warn('invalid collection name type', { name });
    return res.status(400).json({
      error: 'validation_error',
      message: 'name must be a string',
    });
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    log.warn('empty collection name provided');
    return res.status(400).json({
      error: 'validation_error',
      message: 'name cannot be empty',
    });
  }

  if (trimmedName.length < 5) {
    log.warn('collection name too short', { length: trimmedName.length });
    return res.status(400).json({
      error: 'validation_error',
      message: 'name must be at least 5 characters',
    });
  }

  if (trimmedName.length > 255) {
    log.warn('collection name too long', { length: trimmedName.length });
    return res.status(400).json({
      error: 'validation_error',
      message: 'name must be 255 characters or less',
    });
  }

  // Attach validated name to request
  req.validatedQuery = {
    name: trimmedName,
  };

  // Optionally validate and attach collectionId if provided
  if (req.query.collectionId !== undefined) {
    const collectionIdValidation = validateCollectionId(req.query.collectionId);
    if (!collectionIdValidation.isValid) {
      log.warn('invalid collectionId parameter', {
        collectionId: req.query.collectionId,
        error: collectionIdValidation.message,
      });
      return res.status(400).json({
        error: 'validation_error',
        message: collectionIdValidation.message,
      });
    }
    req.validatedQuery.collectionId = collectionIdValidation.id;
  }

  log.trace('collection name validation passed', {
    name: trimmedName,
    collectionId: req.validatedQuery.collectionId,
  });
  next();
};

// Middleware for validating collection update endpoint
const validateCollectionUpdate = (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);

  // Validate collection ID parameter
  const idValidation = validateCollectionId(req.params.id);
  if (!idValidation.isValid) {
    log.warn('invalid collection ID parameter', {
      id: req.params.id,
      error: idValidation.message,
    });
    return res.status(404).json({
      error: 'not_found',
      message: 'Collection does not exist',
    });
  }

  const errors = [];
  const {
    collectionName,
    description,
    isPublic,
    datasets,
  } = req.body;

  // Validate collectionName
  if (collectionName === undefined || collectionName === null) {
    errors.push('collectionName is required');
  } else if (typeof collectionName !== 'string') {
    errors.push('collectionName must be a string');
  } else {
    const trimmedName = collectionName.trim();
    if (trimmedName.length < 5) {
      errors.push('collectionName must be at least 5 characters');
    } else if (trimmedName.length > 200) {
      errors.push('collectionName must be at most 200 characters');
    }
  }

  // Validate description
  if (description === undefined || description === null) {
    errors.push('description is required');
  } else if (typeof description !== 'string') {
    errors.push('description must be a string');
  } else if (description.length > 500) {
    errors.push('description must be at most 500 characters');
  }

  // Validate isPublic flag
  if (isPublic === undefined || isPublic === null) {
    errors.push('isPublic is required');
  } else if (typeof isPublic !== 'boolean') {
    errors.push('isPublic must be a boolean');
  }

  // Validate datasets
  if (datasets === undefined || datasets === null) {
    errors.push('datasets is required');
  } else if (!Array.isArray(datasets)) {
    errors.push('datasets must be an array');
  } else if (!datasets.every((ds) => typeof ds === 'string')) {
    errors.push('all dataset names must be strings');
  }

  if (errors.length > 0) {
    log.warn('validation failed for collection update', {
      errors,
      body: req.body,
    });
    return res.status(400).json({
      error: 'validation_error',
      message: errors.join(', '),
    });
  }

  // Attach validated parameters
  req.validatedParams = {
    id: idValidation.id,
  };
  req.validatedBody = {
    collectionName: collectionName.trim(),
    description,
    isPublic,
    datasets,
  };

  log.trace('collection update validation passed', {
    collectionId: idValidation.id,
    collectionName: collectionName.trim(),
  });
  next();
};

// Middleware for validating collection creation
const validateCollectionCreate = (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);
  const errors = [];
  const validatedBody = {};

  // Validate collectionName (required, 5-200 chars)
  const collectionName = req.body.collectionName;
  if (!collectionName) {
    errors.push('collectionName is required');
  } else if (typeof collectionName !== 'string') {
    errors.push('collectionName must be a string');
  } else {
    const trimmedName = collectionName.trim();
    if (trimmedName.length === 0) {
      errors.push('collectionName cannot be empty');
    } else if (trimmedName.length < 5) {
      errors.push('collectionName must be at least 5 characters');
    } else if (trimmedName.length > 200) {
      errors.push('collectionName must be 200 characters or less');
    } else {
      validatedBody.collectionName = trimmedName;
    }
  }

  // Validate description (optional, 0-500 chars)
  if (req.body.description !== undefined) {
    if (req.body.description === null) {
      validatedBody.description = null;
    } else if (typeof req.body.description !== 'string') {
      errors.push('description must be a string');
    } else if (req.body.description.length > 500) {
      errors.push('description must be 500 characters or less');
    } else {
      validatedBody.description = req.body.description;
    }
  } else {
    validatedBody.description = null;
  }

  // Validate isPublic (optional, boolean, default false)
  if (req.body.isPublic !== undefined) {
    if (typeof req.body.isPublic !== 'boolean') {
      errors.push('isPublic must be a boolean');
    } else {
      validatedBody.isPublic = req.body.isPublic;
    }
  } else {
    validatedBody.isPublic = false;
  }

  // Validate datasets (optional, array of strings)
  if (req.body.datasets !== undefined) {
    if (!Array.isArray(req.body.datasets)) {
      errors.push('datasets must be an array');
    } else {
      const cleanedDatasets = req.body.datasets
        .map((name) => (typeof name === 'string' ? name.trim() : ''))
        .filter((name) => name.length > 0);
      validatedBody.datasets = cleanedDatasets;
    }
  } else {
    validatedBody.datasets = [];
  }

  if (errors.length > 0) {
    log.warn('validation errors in collection creation', {
      errors,
      body: req.body,
    });
    return res.status(400).json({
      error: 'validation_error',
      message: errors.join(', '),
    });
  }

  req.validatedBody = validatedBody;

  log.trace('collection creation validation passed', {
    collectionName: validatedBody.collectionName,
    datasetCount: validatedBody.datasets.length,
  });
  next();
};

// Middleware for validating collection deletion
const validateCollectionDelete = (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);

  // Validate collection ID parameter
  const idValidation = validateCollectionId(req.params.id);
  if (!idValidation.isValid) {
    log.warn('invalid collection ID parameter for delete', {
      id: req.params.id,
      error: idValidation.message,
    });
    return res.status(400).json({
      error: 'invalid_id',
      message: idValidation.message,
    });
  }

  // Attach validated parameters to request object
  req.validatedParams = {
    id: idValidation.id,
  };

  log.trace('collection delete validation passed', {
    collectionId: idValidation.id,
  });
  next();
};

// Middleware for validating collection copy
const validateCollectionCopy = (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);

  // Validate collection ID parameter
  const idValidation = validateCollectionId(req.params.id);
  if (!idValidation.isValid) {
    log.warn('invalid collection ID parameter for copy', {
      id: req.params.id,
      error: idValidation.message,
    });
    return res.status(400).json({
      error: 'invalid_id',
      message: idValidation.message,
    });
  }

  // Attach validated parameters to request object
  req.validatedParams = {
    id: idValidation.id,
  };

  log.trace('collection copy validation passed', {
    collectionId: idValidation.id,
  });
  next();
};

// Middleware for validating calculate row counts endpoint
const validateCalculateRowCounts = (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);
  const errors = [];

  const { shortNames, constraints } = req.body;

  // Validate shortNames
  if (!shortNames) {
    errors.push('shortNames is required');
  } else if (!Array.isArray(shortNames)) {
    errors.push('shortNames must be an array');
  } else if (shortNames.length === 0) {
    errors.push('shortNames must contain at least one dataset name');
  } else if (!shortNames.every((name) => typeof name === 'string')) {
    errors.push('all dataset names in shortNames must be strings');
  }

  // Validate constraints
  if (!constraints) {
    errors.push('constraints is required');
  } else if (typeof constraints !== 'object' || Array.isArray(constraints)) {
    errors.push('constraints must be an object');
  }

  if (errors.length > 0) {
    log.warn('validation errors in calculate row counts', {
      errors,
      body: req.body,
    });
    return res.status(400).json({
      error: 'validation_error',
      message: errors.join(', '),
    });
  }

  log.trace('calculate row counts validation passed', {
    datasetCount: shortNames.length,
  });
  next();
};

const validateCollectionFollow = (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);

  const idValidation = validateCollectionId(req.params.id);
  if (!idValidation.isValid) {
    log.warn('invalid collection ID parameter for follow', {
      id: req.params.id,
      error: idValidation.message,
    });
    return res.status(400).json({
      error: idValidation.message,
    });
  }

  req.validatedParams = {
    id: idValidation.id,
  };

  log.trace('collection follow validation passed', {
    collectionId: idValidation.id,
  });
  next();
};

module.exports = {
  validateCollectionsList,
  validateCollectionDetail,
  validateCollectionNameCheck,
  validateCollectionUpdate,
  validateCollectionCreate,
  validateCollectionDelete,
  validateCollectionCopy,
  validateCalculateRowCounts,
  validateCollectionFollow,
  validateCollectionId,
  validateListQueryParams,
  validateDetailQueryParams,
};
