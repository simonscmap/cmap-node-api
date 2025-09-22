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
    return `${name} > ${wrap(min)}`;
  } else if (
    (min === undefined || min === null) &&
    max !== undefined &&
    max !== null
  ) {
    return `${name} < ${wrap(max)}`;
  } else {
    return '';
  }
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

const getTimeConstraint = (constraints, metadata) => {
  if (!constraints.time) {
    return '';
  }

  const {
    time: { min, max },
  } = constraints;

  const isMonthlyClimatology =
    metadata.Temporal_Resolution === Monthly_Climatology;

  if (isMonthlyClimatology) {
    // Convert date strings to month numbers for climatology datasets
    const { startMonth, endMonth } = convertDatesToMonths(min, max);
    return makeClause('month', startMonth, endMonth);
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
  const selectClauses = {
    count: 'select count(time) as c',
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
