const directQuery = require('../utility/directQuery');
const cacheAsync = require('../utility/cacheAsync');

const getSingleValue = (result, col) =>
  result &&
  result.recordset &&
  result.recordset.length &&
  result.recordset[0][col];

const temporalCoverage = {
  query: `select datediff(year, min(try_cast(Temporal_Coverage_Begin as date)), max(try_cast(Temporal_Coverage_Begin as date))) span_year from tblVariables`,
  resolver: (result) => getSingleValue(result, 'span_year'),
};

const variableCount = {
  query: `select count(*) variables from tblvariables`,
  resolver: (result) => getSingleValue(result, 'variables'),
};

const cruiseCount = {
  query: `select count(*) cruise_expeditions from tblCruise`,
  resolver: (result) => getSingleValue(result, 'cruise_expeditions'),
};

const satelliteCount = {
  query: `select count(distinct Table_Name) satellites from tblvariables where Sensor_ID= (select id from tblSensors where sensor='Satellite')`,
  resolver: (result) => getSingleValue(result, 'satellites'),
};

const organismCount = {
  query: `select count(*) marine_microbial_organisms from tblOrganism`,
  resolver: (result) => getSingleValue(result, 'marine_microbial_organisms'),
};

const keyToJob = {
  temporalCoverage,
  variableCount,
  cruiseCount,
  satelliteCount,
  organismCount,
};

const fetchHighlightByKey = (key) => async () => {
  let job = keyToJob[key];
  let options = {
    description: `${key} highlight`,
  };
  let [error, result] = await directQuery(job.query, options);
  if (error) {
    return [true, null];
  } else {
    return [false, job.resolver(result)];
  }
};

const fetchHighlightWithCache = async (key) =>
  await cacheAsync(
    `CACHE_KEY_HIGHLIGHT_${key}`,
    fetchHighlightByKey(key),
    { ttl: 60 * 60 * 24 }, // 1 day; ttl is given in seconds
  );

module.exports = async (req, res, next) => {
  let { key } = req.query;

  let value = await fetchHighlightWithCache(key);

  if (!value) {
    res.status(500).send('error fetching highlight');
    return next('error fetching highlight');
  } else {
    res.json({ key, value });
    return next();
  }
};
