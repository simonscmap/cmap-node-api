// Helper function to validate ISO date format
const validateISODate = (dateStr) => {
  if (typeof dateStr !== 'string') {
    return false;
  }
  
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!isoDateRegex.test(dateStr)) {
    return false;
  }
  
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

// Helper function to validate spatial bounds
const validateSpatialBounds = (spatial) => {
  const { latMin, latMax, lonMin, lonMax } = spatial;
  
  // Check all values are numbers
  if ([latMin, latMax, lonMin, lonMax].some(val => typeof val !== 'number' || isNaN(val))) {
    return { isValid: false, message: 'spatial bounds must be numbers' };
  }
  
  // Check latitude bounds
  if (latMin < -90 || latMin > 90 || latMax < -90 || latMax > 90) {
    return { isValid: false, message: 'latitude must be between -90 and 90' };
  }
  
  // Check longitude bounds
  if (lonMin < -180 || lonMin > 180 || lonMax < -180 || lonMax > 180) {
    return { isValid: false, message: 'longitude must be between -180 and 180' };
  }
  
  // Check min <= max constraints
  if (latMin > latMax) {
    return { isValid: false, message: 'latMin must be less than or equal to latMax' };
  }
  
  if (lonMin > lonMax) {
    return { isValid: false, message: 'lonMin must be less than or equal to lonMax' };
  }
  
  return { isValid: true };
};

// Helper function to validate depth bounds
const validateDepthBounds = (depth) => {
  const { min, max } = depth;
  
  // Check values are numbers
  if ([min, max].some(val => typeof val !== 'number' || isNaN(val))) {
    return { isValid: false, message: 'depth bounds must be numbers' };
  }
  
  // Check min <= max constraint
  if (min > max) {
    return { isValid: false, message: 'depth min must be less than or equal to depth max' };
  }
  
  return { isValid: true };
};

// Helper function to validate filters
const validateFilters = (filters) => {
  if (!filters || typeof filters !== 'object') {
    return { isValid: false, message: 'filters must be an object' };
  }
  
  const { temporal, spatial, depth } = filters;
  
  // Both temporal and spatial must be present when filters are provided
  if (!temporal || !spatial) {
    return { isValid: false, message: 'filters must include both temporal and spatial parameters' };
  }
  
  // Validate temporal
  if (!temporal.startDate || !temporal.endDate) {
    return { isValid: false, message: 'temporal filters must include startDate and endDate' };
  }
  
  if (!validateISODate(temporal.startDate) || !validateISODate(temporal.endDate)) {
    return { isValid: false, message: 'temporal dates must be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)' };
  }
  
  const startDate = new Date(temporal.startDate);
  const endDate = new Date(temporal.endDate);
  if (startDate > endDate) {
    return { isValid: false, message: 'startDate must be less than or equal to endDate' };
  }
  
  // Validate spatial
  const spatialValidation = validateSpatialBounds(spatial);
  if (!spatialValidation.isValid) {
    return spatialValidation;
  }
  
  // Validate optional depth
  if (depth) {
    const depthValidation = validateDepthBounds(depth);
    if (!depthValidation.isValid) {
      return depthValidation;
    }
  }
  
  return { isValid: true };
};

// Main validation function for bulk download requests
const validateRequest = (req, log) => {
  if (!req.body.shortNames) {
    log.error('missing argument', { body: req.body });
    return {
      isValid: false,
      statusCode: 400,
      message: 'bad request: missing argument',
    };
  }

  let shortNames;
  try {
    shortNames = JSON.parse(req.body.shortNames);
  } catch (e) {
    log.error('error parsing post body', { error: e, body: req.body });
    return {
      isValid: false,
      statusCode: 400,
      message: 'bad request: invalid json',
    };
  }

  if (!Array.isArray(shortNames) || shortNames.length === 0) {
    log.error('incorrect argument type: expected non-empty array of strings');
    return {
      isValid: false,
      statusCode: 400,
      message: 'bad request: incorrect argument type',
    };
  }

  // Validate optional filters parameter
  let filters = null;
  if (req.body.filters) {
    let parsedFilters;
    try {
      parsedFilters = typeof req.body.filters === 'string' 
        ? JSON.parse(req.body.filters) 
        : req.body.filters;
    } catch (e) {
      log.error('error parsing filters', { error: e, filters: req.body.filters });
      return {
        isValid: false,
        statusCode: 400,
        message: 'bad request: invalid filters json',
      };
    }
    
    const filterValidation = validateFilters(parsedFilters);
    if (!filterValidation.isValid) {
      log.error('invalid filters', { filters: parsedFilters, error: filterValidation.message });
      return {
        isValid: false,
        statusCode: 400,
        message: `bad request: ${filterValidation.message}`,
      };
    }
    
    filters = parsedFilters;
  }

  return { isValid: true, shortNames, filters };
};

module.exports = {
  validateISODate,
  validateSpatialBounds,
  validateDepthBounds,
  validateFilters,
  validateRequest,
};