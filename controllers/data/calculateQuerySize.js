const logInit = require('../../log-service');

const moduleLogger = logInit('calculateQuerySize');

// Calculate query size for gridded dataset
const isNaN = Number.isNaN;

// Temporal Resolution value for monthly climatology
const Monthly_Climatology = 'Monthly Climatology';

const getUnixTimestamp = (dateLike) => new Date(dateLike).getTime();
// const isValidDateObject = (maybeDate) => maybeDate instanceof Date && !isNaN(maybeDate);

const isDateWithoutTimeStamp = (dateString) =>
  dateString.slice(0, 10).length === 10;

// Generic Ratio Calculation
// NOTE: if there is an obstacle to performing the divison, return 1 as the default factor
// getRatio :: Min Number -> Max Number -> Subset Min Number -> Subset Max Number -> [ Warning?, Ratio]
// a1 and a2 are the extremes for the dataset
// b1 and b2 describe the subset
const getRatio = (a1, a2, b1, b2, tag = '') => {
  // b1 can't be less than a1, and b2 can't be greater than a2
  // although this can sometimes happen by a quirk of the way non-subsetted download
  // queries are constructed
  if (b1 < a1) {
    b1 = a1;
  }
  if (b2 > a2) {
    b2 = a2;
  }
  let maxSpan = a2 - a1;
  let subSpan = b2 - b1;
  if (
    maxSpan <= 0 ||
    subSpan < 0 ||
    subSpan > maxSpan ||
    isNaN(subSpan) ||
    isNaN(maxSpan)
  ) {
    moduleLogger.warn('unable to calculate ratio', { tag, a1, a2, b1, b2 });
    return [
      `Unable to calculate "${tag}" ratio between ${maxSpan} and ${subSpan}`,
      1,
    ];
  }
  moduleLogger.debug('getRatio result', {
    tag,
    maxSpan,
    subSpan,
    ratio: subSpan / maxSpan,
  });
  return [null, subSpan / maxSpan];
};

const getDateRatio = (
  Time_Min,
  Time_Max,
  t1,
  t2,
  isMonthlyClimatology,
  timeDelta,
) => {
  if (isMonthlyClimatology) {
    moduleLogger.debug('getDateRatio: MONTHLY CLIMATOLOGY t1 t2', t1, t2);
    // t1 and t2 are integers representing months
    return [null, (t2 - t1 + 1) / 12];
  }

  // Convert dates to timestamps

  let tMinUnix = getUnixTimestamp(Time_Min);
  let tMaxUnix = getUnixTimestamp(Time_Max);

  let t1Unix = getUnixTimestamp(t1);
  let t2Unix = getUnixTimestamp(t2);

  moduleLogger.trace('getDateRatio', { tMinUnix, tMaxUnix, t1Unix, t2Unix });

  // if the times are the same, check the specificity of the time string
  // select * from tbl where time between '2012-09-15' and '2012-09-15' will match any times
  // during the day of the 15th, namely between '2012-09-15' and '2012-09-15T23:59:59Z'
  if (t1 === t2 && isDateWithoutTimeStamp(t2)) {
    let t2EndOfDay = `${new Date(t2).toISOString().slice(0, 10)}T23:59:59Z`;
    moduleLogger.debug('MODIFYING t2EndOfDay', { t2, t2EndOfDay });
    t2Unix = getUnixTimestamp(t2EndOfDay);
  }

  if (t2Unix - t1Unix < 0) {
    return [`Unable to calculate time ratio between ${t1} and ${t2}`, 1];
  }
  if (isNaN(tMinUnix) || isNaN(tMaxUnix || isNaN(t1Unix) || isNaN(t2Unix))) {
    return [
      `Unable to calculate time ratio between (${Time_Min}, ${Time_Max}) and (${t1}, ${t2})`,
      1,
    ];
  }

  return getRatio(tMinUnix, tMaxUnix, t1Unix, t2Unix, 'time');
};

const getLatRatio = (Lat_Min, Lat_Max, lat1, lat2) => {
  return getRatio(Lat_Min, Lat_Max, lat1, lat2, 'lat');
};

const getLonRatio = (Lon_Min, Lon_Max, lon1, lon2) => {
  return getRatio(Lon_Min, Lon_Max, lon1, lon2, 'lon');
};

// Get Depth Ratio
// getDepthRatio :: Subset Depth Min -> Subset Depth Max -> [ Sorted Depths ] -> [Error?, Ratio]
const getDepthRatio = (depth1, depth2, depths) => {
  if (!Array.isArray(depths)) {
    // return error and default factor of 1 (worst case scenario)
    return [`Unable to calculate depth; no depths provided`, 1];
  }

  // no depth constraints
  if (!depth1 && !depth2) {
    return [null, 1];
  }

  // fallback values for depth constraints
  if (!depth1) {
    depth1 = 0;
  }

  if (!depth2) {
    depth2 = depths[depths.length - 1];
  }

  // count the nubmber of depths that fall between depth1 and depth2
  let count = 0;
  for (let i = 0; i < depths.length; i++) {
    if (depths[i] > depth2) {
      break;
    }
    if (depths[i] >= depth1) {
      count++;
    }
  }
  if (count === 0 || depths.length === 0) {
    return [
      `Unable to calculate depth ratio between ${depth1} and ${depth2} yielding count of ${count} with total depths of ${depths.length}`,
      1,
    ];
  }
  return [null, count / depths.length];
};

const calculateFactors = (constraints, dataset, depths) => {
  let { Time_Min, Time_Max, Lat_Min, Lat_Max, Lon_Min, Lon_Max } = dataset;

  let { time, lat, lon, depth } = constraints;

  let deltas = constraints.deltas || {};

  // get ratios
  let isMonthlyClimatology =
    dataset.Temporal_Resolution === Monthly_Climatology;
  let [dateRatioWarning, dateRatio] = getDateRatio(
    Time_Min,
    Time_Max,
    time.min,
    time.max,
    isMonthlyClimatology,
    deltas.time,
  );

  let [latRatioWarning, latRatio] = getLatRatio(
    Lat_Min,
    Lat_Max,
    lat.min,
    lat.max,
    deltas.lat,
  );
  let [lonRatioWarning, lonRatio] = getLonRatio(
    Lon_Min,
    Lon_Max,
    lon.min,
    lon.max,
    deltas.lon,
  );

  let [depthRatioWarning, depthRatio] = getDepthRatio(
    depth.min,
    depth.max,
    depths,
  );

  let warnings = [
    dateRatioWarning,
    latRatioWarning,
    lonRatioWarning,
    depthRatioWarning,
  ].filter((m) => !!m);
  // multiply totoal row count for dataset by each factor
  // TODO generate warnings
  return [warnings, dateRatio, latRatio, lonRatio, depthRatio];
};

function calculateSize(constraints, dataset, depths, log = moduleLogger) {
  if (constraints === null) {
    return [dataset.Row_Count, ['No constraints were provided']];
  }

  let [messages, ...factors] = calculateFactors(
    constraints,
    dataset,
    depths,
    log,
  );
  let [date, lat, lon, depth] = factors;
  let result = Math.ceil(dataset.Row_Count * date * lat * lon * depth);

  log.debug('calculating size with the following factors', {
    datasetRowCount: dataset.Row_Count,
    timeFactor: date,
    latFactor: lat,
    lonFactor: lon,
    depthFactor: depth,
    result,
  });

  messages.push(
    `result: ${result} (factors: row count: ${dataset.Row_Count}, date ${date}, lat ${lat}, lon ${lon}, depth ${depth})`,
  );

  // pull revelant props from dataset
  let datasetSummary = [
    'Dataset_ID',
    'Short_Name',
    'Table_Name',
    'Row_Count',
    'Time_Min',
    'Time_Max',
    'Lat_Min',
    'Lat_Max',
    'Lon_Min',
    'Lon_Max',
    'Spatial_Resolution',
    'Temporal_Resolution',
  ].reduce((acc, curr) => {
    return { ...acc, [curr]: dataset[curr] };
  }, {});

  return [result, messages, datasetSummary];
}

module.exports = {
  calculateSize,
  calculateFactors,
  getRatio,
  getDateRatio,
  getLatRatio,
  getLonRatio,
  getDepthRatio,
};
