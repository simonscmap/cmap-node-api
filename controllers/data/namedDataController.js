const initializeLogger = require("../../log-service");
const moduleLogger = initializeLogger("controllers/namedData");
const sparqQuery = require("../../utility/queryHandler/sparqQuery");
const cache = require("../../utility/nodeCache");


const transformDataToTraceLines = (data, dataKey) => {
  if (!data) {
    return null;
  }
  return data.reduce((acc, curr) => {
    const { lat, lon, year, month } = curr;
    const key = `${lat},${lon}`;
    const date = `${year}, ${month}`;
    let val = curr[dataKey];
    if (val && typeof val.toFixed === 'function') {
      // val = val.toFixed (1);
    }
    if (!acc[key]) {
      acc[key] = { x: [], y: [] };
    }
    acc[key].x.push(date);
    acc[key].y.push(val);
    return acc;
  }, {});
}

const sstAnomalyPlotData = async (req, res, next) => {
  const cacheKey = 'SST_ANOM_PROCESSED';
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    res.json (cachedData);
    return next();
  }

  const query = 'select year, month, lat, lon, sst_res from tblts_sst where sst_res IS NOT NULL order by year desc, month desc'; // limit 10000

  const [e, result] = await sparqQuery (query, req.reqId);
  if (e) {
    res.status(500).send();
    return next ();
  }
  // Process data
  const lines = transformDataToTraceLines (result, 'sst_res');

  cache.set (cacheKey, lines);

  res.json (lines);
  next ();
}

const adtAnomalyPlotData = async (req, res, next) => {
  const cacheKey = 'ADT_ANOM_PROCESSED';
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    res.json (cachedData);
    return next();
  }

  const query = 'select year, month, lat, lon, adt_res from tblts_adt where adt_res IS NOT NULL order by year desc, month desc'; // limit 10000

  const [e, result] = await sparqQuery (query, req.reqId);
  if (e) {
    res.status(500).send();
    return next();
  }
  // Process data
  const lines = transformDataToTraceLines (result, 'adt_res');

  cache.set (cacheKey, lines);

  res.json (lines);
  next ();
}

const namedData = async (req, res, next) => {
  const name = req.params.name;
  switch (name) {
    case 'sst':
      await sstAnomalyPlotData (req, res, next);
      break;
    case 'adt':
      await adtAnomalyPlotData (req, res, next);
      break;
    default:
      moduleLogger.warn ('no name param on /api/data/named route');
      break;
  }
  next ();
};


module.exports = namedData;
