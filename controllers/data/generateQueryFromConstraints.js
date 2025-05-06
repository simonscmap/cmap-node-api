const { v4: uuidv4 } = require('uuid');

const Monthly_Climatology = 'Monthly Climatology';

const wrap = (val) => (typeof val === 'string' ? `'${val}'` : val);

const makeClause = (name, min, max) => {
  if (min && max) {
    return `${name} between ${wrap(min)} and ${wrap(max)}`;
  } else if (min && !max) {
    return `${name} > ${wrap(min)}`;
  } else if (!min && max) {
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

const getLatConstraint = (constraints) => {
  let {
    lat: { min, max },
  } = constraints;
  let latMin = parseFloatOrNull(min);
  let latMax = parseFloatOrNull(max);
  return makeClause('lat', latMin, latMax);
};

const getLonConstraint = (constraints) => {
  let {
    lon: { min, max },
  } = constraints;
  let lonMin = parseFloatOrNull(min);
  let lonMax = parseFloatOrNull(max);
  return makeClause('lon', lonMin, lonMax);
};

const getDepthConstraint = (constraints) => {
  let {
    depth: { min, max },
  } = constraints;
  let depthMin = parseFloatOrNull(min);
  let depthMax = parseFloatOrNull(max);
  return makeClause('depth', depthMin, depthMax);
};

const getTimeConstraint = (constraints, dataset) => {
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
  return `where ${constraints.join(' AND ')}`;
};

const generateQuery = (tablename, constraints, dataset) => {
  if (constraints === null) {
    return `select count(time) as c from ${tablename}`;
  }

  let latConstraint = getLatConstraint(constraints);
  let lonConstraint = getLonConstraint(constraints);
  let depthConstraint = getDepthConstraint(constraints);
  let timeConstraint = getTimeConstraint(constraints, dataset);

  let joinedConstraints = joinConstraints([
    timeConstraint,
    latConstraint,
    lonConstraint,
    depthConstraint,
  ]);
  let id = uuidv4().slice(0, 5);

  let query =
    `select count(time) as c, 'id${id}' as id from ${tablename} ${joinedConstraints}`.trim();

  return query;
};

module.exports = generateQuery;
