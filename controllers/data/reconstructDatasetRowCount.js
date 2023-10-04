const { internalRouter } = require ('../../utility/router/internal-router');
const Monthly_Climatology = 'Monthly Climatology';

// gitTime returns miliseconds from the Unix Epoch
const getUnixTimestamp = (dateLike) => (new Date(dateLike)).getTime();

const isMsSQLResult = (result) => result && !!result.recordset;

const extractResult = (result) => {
  if (!result) {
    return null;
  }
  // on prem
  if (isMsSQLResult (result)) {
    if (result.recordsets.length > 1) {
      return result.recordsets;
    } else {
      return result.recordset;
    }
  }
  // cluster
  return result;
}

const getLatConstraint = (dataset) => {
  let latMin = parseFloat(dataset.Lat_Min);
  if (isNaN (latMin)) {
    return '';
  }
  return `lat between ${latMin} and ${latMin + 1}`;
}

const getLonConstraint = (dataset) => {
  let lonMin = parseFloat(dataset.Lon_Min);
   if (isNaN (lonMin)) {
    return '';
  }
  return `lon between ${lonMin} and ${lonMin + 1}`;
}
const getDepthConstraint = (dataset) => {
  let depthMin = parseFloat(dataset.Depth_Min);
   if (isNaN (depthMin)) {
    return '';
  }
  return `depth between ${depthMin} and ${depthMin + 1}`;
}
const getTimeConstraint = (dataset) => {
  if (dataset.Temporal_Resolution === Monthly_Climatology) {
    return `month = ${dataset.Time_Min}`;
  }
  let dateMin = (new Date(dataset.Time_Min)).toISOString().slice(0,10);
  return `time between '${dateMin}' AND '${dateMin}'`;
}

const joinConstraints = (arr) => {
  let constraints = arr.filter((str) => !!str.length);
  return `where ${constraints.join(' AND ')}`;
}

const fetchDims = async (tableName, dataset) => {
  let latConstraint = getLatConstraint (dataset);
  let lonConstraint = getLonConstraint (dataset);
  let depthConstraint = getDepthConstraint (dataset);
  let timeConstraint = getTimeConstraint (dataset);

  let queryTime = `select top 2 distinct time from ${tableName}
                   ${joinConstraints([latConstraint, lonConstraint, depthConstraint])}
                   order by time desc`;

  let queryLat = `select top 2 distinct lat from ${tableName}
                   ${joinConstraints([timeConstraint, lonConstraint, depthConstraint])}
                  order by lat desc`;

  let queryLon = `select top 2 distinct lon from ${tableName}
                  ${joinConstraints([timeConstraint, latConstraint, depthConstraint])}
                  order by lon desc`;

  let [timeError, timeResult] = await internalRouter (queryTime);
  console.log ('time result', timeResult);

  let [latError, latResult] = await internalRouter (queryLat);
  console.log ('latResult', latResult);

  let [lonError, lonResult] = await internalRouter (queryLon);
  console.log('lonResult', lonResult);

  if (timeError || latError || lonError) {
    return [timeError || latError || lonError];
  }

  let results = {
    time: extractResult(timeResult),
    lat: extractResult(latResult),
    lon: extractResult(lonResult),
  };

  return [null, results];
}

// generateRowCount
// :: Dataset -> Table Name -> [ Error?, Datapoints, Deltas ]
// Datapoints ::
const generateRowCount = async (dataset, tableName, depths) => {
  // get two consecutive, distinct values for each dimension (except depth)
  let [error, result] = await fetchDims (tableName, dataset);
  if (error) {
    return [error];
  }

  // calculate the interval, or 'delta', for each dimension
  let deltas = Object.keys(result).reduce((acc, key) => {
    if (result[key] === null) {
      return Object.assign(acc, { [key]: null });
    }
    let [k1, k2] = result[key].map((item) => item[key]);
    if (key === 'time') {
      // console.log ('converting ticks to ms', k1, k2);
      k1 = getUnixTimestamp (k1);
      k2 = getUnixTimestamp (k2);
    }
    return Object.assign(acc, {
      [key]: Math.abs(k2 - k1),
    })
  }, {});

  // count for an axis is max - min / resolution
  let getCount = (max, min, resolution) => {
    // console.log('get count', `(${max} - ${min})/${resolution}`, `${max - min}/${resolution}`, ((max - min) / resolution));
    return Math.floor((max - min) / resolution);
  };

  // calculate the number of ticks for each dimension: how many intervals between min and max
  let counts = Object.keys(deltas).reduce((acc, key) => {
    let c;

    if (key === 'time') {
      // console.log('calculating time ticks', dataset.Time_Max, dataset.Time_Min, deltas.time);
      c = getCount (
        getUnixTimestamp (dataset.Time_Max),
        getUnixTimestamp (dataset.Time_Min),
        deltas.time
      );
      console.log('result', c);
    } else if (key === 'lat') {
      c = getCount (dataset.Lat_Max, dataset.Lat_Min, deltas.lat);
    } else if (key === 'lon') {
      c = getCount (dataset.Lon_Max, dataset.Lon_Min, deltas.lon);
    }

    return Object.assign (acc, { [key]: c });
  }, {});

  // depth is handled differently, because it doesn't have a regular interval; it has as many
  // ticks as unique depths
  Object.assign(counts, { depth: depths.length });

  // calculate datapoints in the dataset by multiplying each dimension
  let datapoints = Math.abs(Object.entries(counts).reduce ((acc, curr) => {
    let [_, v] = curr;
    return acc * v;
  }, 1));

  console.log ('ticks', result);
  console.log ('deltas', deltas);
  console.log ('counts', counts);
  console.log ('total datapoints', datapoints);
  return [null, datapoints, deltas];
};

module.exports = generateRowCount;
