const Monthly_Climatology = 'Monthly Climatology';
const wrap = (val) => (typeof val === 'string' ? `'${val}'` : val);

const makeClause = (name, min, max) => {
  if (min !== undefined && min !== null && max !== undefined && max !== null) {
    return `${name} between ${wrap(min)} and ${wrap(max)}`;
  } else if (
    min !== undefined &&
    min !== null &&
    (max === undefined || max === null)
  ) {
    return `${name} >= ${wrap(min)}`;
  } else if (
    (min === undefined || min === null) &&
    max !== undefined &&
    max !== null
  ) {
    return `${name} <= ${wrap(max)}`;
  } else {
    return '';
  }
};

const makeInClause = (name, values) => {
  if (!values || !Array.isArray(values) || values.length === 0) {
    return '';
  }
  const wrappedValues = values.map((v) => wrap(v)).join(', ');
  return `${name} IN (${wrappedValues})`;
};

const parseFloatOrNull = (n) => {
  let parsedN = parseFloat(n);
  if (isNaN(parsedN)) {
    return null;
  } else {
    return parsedN;
  }
};

const checkDatasetHasDepth = (metadata) => {
  if (!metadata) {
    return false;
  }

  // If dataset has a variables array (from metadata), check if any variable has depth
  if (metadata.variables && Array.isArray(metadata.variables)) {
    return metadata.variables.some(
      (variable) =>
        variable.Has_Depth === true ||
        (variable.Depth_Min !== undefined && variable.Depth_Min !== null) ||
        (variable.Depth_Max !== undefined && variable.Depth_Max !== null),
    );
  }

  // If dataset has Has_Depth directly (some dataset objects may have this at root level)
  if (typeof metadata.Has_Depth === 'boolean') {
    return metadata.Has_Depth;
  }

  if (
    (metadata.Depth_Min !== undefined && metadata.Depth_Min !== null) ||
    (metadata.Depth_Max !== undefined && metadata.Depth_Max !== null)
  ) {
    return true;
  }

  // Default to false if we can't determine depth capability
  return false;
};

const getLatConstraint = (constraints) => {
  if (!constraints.lat) {
    return '';
  }
  let {
    lat: { min, max },
  } = constraints;
  let latMin = parseFloatOrNull(min);
  let latMax = parseFloatOrNull(max);
  return makeClause('lat', latMin, latMax);
};

const getLonConstraint = (constraints) => {
  if (!constraints.lon) {
    return '';
  }
  let {
    lon: { min, max },
  } = constraints;
  let lonMin = parseFloatOrNull(min);
  let lonMax = parseFloatOrNull(max);

  if (lonMin !== null && lonMax !== null && lonMin > lonMax) {
    return `NOT (lon > ${lonMax} AND lon < ${lonMin})`;
  }

  return makeClause('lon', lonMin, lonMax);
};

const getDepthConstraint = (constraints, metadata) => {
  // Check if depth constraints are provided
  if (!constraints.depth) {
    return '';
  }

  // Only apply depth constraints if the dataset has depth dimensions
  const hasDepthDimension = checkDatasetHasDepth(metadata);
  if (!hasDepthDimension) {
    return '';
  }

  let {
    depth: { min, max },
  } = constraints;
  let depthMin = parseFloatOrNull(min);
  let depthMax = parseFloatOrNull(max);
  return makeClause('depth', depthMin, depthMax);
};

const convertDatesToMonths = (startDate, endDate) => {
  // Convert date strings to Date objects
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculate the duration in milliseconds
  const durationMs = end - start;
  const oneYearMs = 365.25 * 24 * 60 * 60 * 1000; // Account for leap years

  // If the range is >= 1 year, include all 12 months
  if (durationMs >= oneYearMs) {
    return { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
  }

  // If the range is < 1 year, extract the specific months in the range
  const startMonth = start.getMonth() + 1; // 1-12
  const endMonth = end.getMonth() + 1; // 1-12

  // Generate array of months in the range
  const months = [];
  if (startMonth <= endMonth) {
    // Same year or non-wrapping range (e.g., March to August)
    for (let m = startMonth; m <= endMonth; m++) {
      months.push(m);
    }
  } else {
    // Cross-year range (e.g., November to February)
    // Add months from start to December
    for (let m = startMonth; m <= 12; m++) {
      months.push(m);
    }
    // Add months from January to end
    for (let m = 1; m <= endMonth; m++) {
      months.push(m);
    }
  }

  return { months };
};

const getTimeConstraint = (constraints, metadata) => {
  if (!constraints.time) {
    return '';
  }

  const {
    time: { min, max },
  } = constraints;

  // Check for Temporal_Resolution in both metadata.dataset and metadata (for backwards compatibility)
  const temporalResolution = (metadata && metadata.dataset && metadata.dataset.Temporal_Resolution) ||
                              (metadata && metadata.Temporal_Resolution);
  const isMonthlyClimatology = temporalResolution === Monthly_Climatology;

  if (isMonthlyClimatology) {
    // Convert date strings to month array for climatology datasets
    const { months } = convertDatesToMonths(min, max);
    return makeInClause('month', months);
  } else {
    return makeClause('time', min, max);
  }
};

const joinConstraints = (arr) => {
  let constraints = arr.filter((str) => !!str.length);
  return constraints.length > 0 ? `where ${constraints.join(' AND ')}` : '';
};

const buildConstraints = (constraints, metadata) => {
  const timeConstraint = getTimeConstraint(constraints, metadata);
  const latConstraint = getLatConstraint(constraints);
  const lonConstraint = getLonConstraint(constraints);
  const depthConstraint = getDepthConstraint(constraints, metadata);

  return joinConstraints([
    timeConstraint,
    latConstraint,
    lonConstraint,
    depthConstraint,
  ]);
};

const generateQuery = (
  tablename,
  constraints,
  metadata,
  queryType = 'count',
) => {
  // Determine the appropriate time column based on temporal resolution
  // Check for Temporal_Resolution in both metadata.dataset and metadata (for backwards compatibility)
  const temporalResolution = (metadata && metadata.dataset && metadata.dataset.Temporal_Resolution) ||
                              (metadata && metadata.Temporal_Resolution);
  const isMonthlyClimatology = temporalResolution === Monthly_Climatology;
  const timeColumnName = isMonthlyClimatology ? 'month' : 'time';

  const selectClauses = {
    count: `select count(${timeColumnName}) as c`,
    data: 'select *',
  };

  const clause = selectClauses[queryType] || selectClauses['count'];

  if (constraints === null) {
    return `${clause} from ${tablename}`;
  }

  const whereClause = buildConstraints(constraints, metadata);
  return `${clause} from ${tablename} ${whereClause}`.trim();
};

module.exports = generateQuery;
