const initializeLogger = require('../../log-service');
const moduleLogger = initializeLogger('controllers/namedData');
const runClusterQuery = require('../../utility/queryHandler/runClusterQuery');
const preWarmCacheAsync = require('../../utility/preWarmCacheAsync');
const cacheAsync = require('../../utility/cacheAsync');

const oneMonthInSeconds = 60 * 60 * 24 * 30;

// take sql result and transform it into an object
// with `lat,lon` keys pointing to trace data
const transformDataToTraceLines = (data, dataKey) => {
  if (!data) {
    return null;
  }
  return data.reduce((acc, curr) => {
    const { lat, lon, year, month } = curr;
    const key = `${lat},${lon}`;
    const date = `${year}, ${month}`;
    let val = curr[dataKey];
    if (typeof val === 'number') {
      // val = Math.round(val * 100);
      // val = val.toFixed (1);
    }
    if (!acc[key]) {
      acc[key] = { x: [], y: [] };
    }
    acc[key].x.push(date);
    acc[key].y.push(val);
    return acc;
  }, {});
};

/* SST */
const fetchSSTAnomalyData = async () => {
  const query = `SELECT year, month, lat, lon, sst_res
    FROM tblts_sst
    WHERE sst_res IS NOT NULL
    ORDER BY year desc, month desc`;

  const startQuery = Date.now();
  const [e, result] = await runClusterQuery(query);
  moduleLogger.debug('sst query time', { duration: Date.now() - startQuery });

  if (e) {
    return [true];
  }

  // Process data
  const startTransform = Date.now();
  const lines = transformDataToTraceLines(result, 'sst_res');
  moduleLogger.debug('sst trx time', { duration: Date.now() - startTransform });

  return [false, lines];
};

const sstCacheKey = 'SST_ANOM_PROCESSED';
const sstCacheOptions = { ttl: oneMonthInSeconds };
// preWarmCacheAsync (sstCacheKey, fetchSSTAnomalyData, sstCacheOptions);

const sstAnomalyPlotData = async (req, res, next) => {
  moduleLogger.trace('executing named route: sst anomaly data', null);
  const result = await cacheAsync(
    sstCacheKey,
    fetchSSTAnomalyData,
    sstCacheOptions,
  );
  if (!result) {
    res.status(500).send();
    return next();
  }

  res.json(result);
  next();
};

/* AVG SST */
const fetchAvgSSTAnomalyData = async () => {
  const query = `SELECT year, month, avg(sst_res) sst_res
    FROM tblts_sst
    GROUP BY year, month
    ORDER BY year desc, month desc`;

  const startQuery = Date.now();
  const [e, result] = await runClusterQuery(query);

  moduleLogger.debug('sst query time', { duration: Date.now() - startQuery });

  if (e) {
    return [true];
  }

  // Process data
  const startTransform = Date.now();
  const lines = transformDataToTraceLines(result, 'sst_res');
  moduleLogger.debug('avg sst trx time', {
    duration: Date.now() - startTransform,
  });

  return [false, lines];
};

const avgSSTCacheKey = 'AVG_SST_ANOM_PROCESSED';
const avgSSTCacheOptions = { ttl: oneMonthInSeconds };
// preWarmCacheAsync(avgSSTCacheKey, fetchAvgSSTAnomalyData, avgSSTCacheOptions);

const avgSSTAnomalyPlotData = async (req, res, next) => {
  moduleLogger.trace('executing named route: avg sst anomaly data', null);
  const result = await cacheAsync(
    avgSSTCacheKey,
    fetchAvgSSTAnomalyData,
    avgSSTCacheOptions,
  );
  if (!result) {
    res.status(500).send();
    return next();
  }

  res.json(result);
  next();
};

/* ADT */
const fetchADTAnomalyData = async () => {
  const query = `SELECT year, month, lat, lon, adt_res
    FROM tblts_adt
    WHERE adt_res IS NOT NULL
    ORDER BY year desc, month desc`;

  const startQuery = Date.now();
  const [e, result] = await runClusterQuery(query);
  moduleLogger.debug('adt query time', { duration: Date.now() - startQuery });

  if (e) {
    return [true];
  }

  // Process data
  const startTransform = Date.now();
  const lines = transformDataToTraceLines(result, 'adt_res');
  moduleLogger.debug('adt trx time', { duration: Date.now() - startTransform });

  return [false, lines];
};
const adtCacheKey = 'ADT_ANOM_PROCESSED';
const adtCacheOptions = { ttl: oneMonthInSeconds };
// TODO: uncomment when databricks experiment is completed
// preWarmCacheAsync (adtCacheKey, fetchADTAnomalyData, adtCacheOptions);

const adtAnomalyPlotData = async (req, res, next) => {
  moduleLogger.trace('executing named route: adt anomaly data', null);
  const result = await cacheAsync(
    adtCacheKey,
    fetchADTAnomalyData,
    adtCacheOptions,
  );
  if (!result) {
    res.status(500).send();
    return next();
  }
  res.json(result);
  next();
};

/* AVG ADT */
const fetchAvgADTAnomalyData = async () => {
  const query = `SELECT year, month, avg(adt_res) adt_res
    FROM tblts_adt
    GROUP BY year, month
    ORDER BY year desc, month desc`;

  const startQuery = Date.now();
  const [e, result] = await runClusterQuery(query);
  moduleLogger.debug('adt query time', { duration: Date.now() - startQuery });

  if (e) {
    return [true];
  }

  // Process data
  const startTransform = Date.now();
  const lines = transformDataToTraceLines(result, 'adt_res');
  moduleLogger.debug('avg adt trx time', {
    duration: Date.now() - startTransform,
  });

  return [false, lines];
};
const avgAdtCacheKey = 'AVG_ADT_ANOM_PROCESSED';
const avgAdtCacheOptions = { ttl: oneMonthInSeconds };
// TODO: uncomment when databricks experiment is completed
// preWarmCacheAsync(avgAdtCacheKey, fetchAvgADTAnomalyData, avgAdtCacheOptions);

const avgAdtAnomalyPlotData = async (req, res, next) => {
  moduleLogger.trace('executing named route: avg adt anomaly data', null);
  const result = await cacheAsync(
    avgAdtCacheKey,
    fetchAvgADTAnomalyData,
    avgAdtCacheOptions,
  );
  if (!result) {
    res.status(500).send();
    return next();
  }
  res.json(result);
  next();
};

const namedDataController = async (req, res, next) => {
  const name = req.params.name;
  switch (name) {
    case 'sst':
      await sstAnomalyPlotData(req, res, next);
      break;
    case 'avg-sst':
      await avgSSTAnomalyPlotData(req, res, next);
      break;
    case 'adt':
      await adtAnomalyPlotData(req, res, next);
      break;
    case 'avg-adt':
      await avgAdtAnomalyPlotData(req, res, next);
      break;
    default:
      moduleLogger.warn('no name param on /api/data/named route');
      break;
  }
  next();
};

module.exports = { namedDataController };
