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

const checkDatasetHasDepth = (dataset) => {
  if (!dataset) {
    return false;
  }

  // If dataset has a variables array (from metadata), check if any variable has depth
  if (dataset.variables && Array.isArray(dataset.variables)) {
    return dataset.variables.some(
      (variable) =>
        variable.Has_Depth === true ||
        (variable.Depth_Min !== undefined && variable.Depth_Min !== null) ||
        (variable.Depth_Max !== undefined && variable.Depth_Max !== null),
    );
  }

  // If dataset has Has_Depth directly (some dataset objects may have this at root level)
  if (typeof dataset.Has_Depth === 'boolean') {
    return dataset.Has_Depth;
  }

  if (
    (dataset.Depth_Min !== undefined && dataset.Depth_Min !== null) ||
    (dataset.Depth_Max !== undefined && dataset.Depth_Max !== null)
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

const getDepthConstraint = (constraints, dataset) => {
  // Check if depth constraints are provided
  if (!constraints.depth) {
    return '';
  }

  // Only apply depth constraints if the dataset has depth dimensions
  const hasDepthDimension = checkDatasetHasDepth(dataset);
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

const getTimeConstraint = (constraints, dataset) => {
  if (!constraints.time) {
    return '';
  }
  let isMonthlyClimatology =
    dataset.Temporal_Resolution === Monthly_Climatology;
  let colName = isMonthlyClimatology ? 'month' : 'time';
  let {
    time: { min, max },
  } = constraints;
  return makeClause(colName, min, max);
};

const joinConstraints = (arr) => {
  let constraints = arr.filter((str) => !!str.length);
  return constraints.length > 0 ? `where ${constraints.join(' AND ')}` : '';
};

const buildConstraints = (constraints, dataset) => {
  const timeConstraint = getTimeConstraint(constraints, dataset);
  const latConstraint = getLatConstraint(constraints);
  const lonConstraint = getLonConstraint(constraints);
  const depthConstraint = getDepthConstraint(constraints, dataset);

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
  dataset,
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

  const whereClause = buildConstraints(constraints, dataset);
  return `${clause} from ${tablename} ${whereClause}`.trim();
};

module.exports = generateQuery;
