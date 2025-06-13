const { makeDataQuery } = require('../../utility/prepareOnPremQuery');
const logInit = require('../../log-service');
const moduleLogger = logInit('controllers/catalog/getProgramDatasets');
const { TRAJECTORY_POINTS_LIMIT } = require('../../utility/constants');
const { debugTimer } = require('../../utility/debugTimer');

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#instance_methods
// because this instance method does not show up in nodejs until v22
function difference(setA, setB) {
  const _difference = new Set(setA);
  for (const elem of setB) {
    _difference.delete(elem);
  }
  return _difference;
}

const queryCruisesWithDatasetId = (datasetId) =>
  `SELECT ID FROM tblCruise c
   JOIN tblDataset_Cruises dc ON c.ID = dc.Cruise_ID
   WHERE dc.Dataset_ID = ${datasetId}`;

// :: datasetId -> [error, [CruiseId]]
const listCruisesForDatasetId = async (datasetId, reqId) => {
  const queryString = queryCruisesWithDatasetId(datasetId);
  const operationName = 'list cruises for dataset';

  const [err, result, fullResp] = await makeDataQuery(queryString, reqId, {
    operationName,
  });

  if (err) {
    throw new Error(err);
  }

  if (result && result.length) {
    const transformedResult = result.map(({ ID }) => ID);
    return transformedResult;
  } else {
    return null;
  }
};

const cruisesForDatasetList = async (datasetIds, reqId) => {
  const log = moduleLogger.setReqId(reqId);

  let results;
  try {
    results = await Promise.all(
      datasetIds.map((id) => listCruisesForDatasetId(id, reqId)),
    );
  } catch (e) {
    log.error('error while fetching curises for dataset list', { error: e });
  }

  const map = {}; // { Dataset_ID: [cruiseIds] }
  const list = new Set();
  results.forEach((result, index) => {
    if (result) {
      const cruiseData = result;
      if (cruiseData) {
        map[datasetIds[index]] = cruiseData;
        cruiseData.forEach((item) => list.add(item));
      }
    }
  });

  return [null, { map, list: Array.from(list) }];
};

const fetchDatasetsForCruises = async (cruiseIds, reqId) => {
  const log = moduleLogger.setReqId(reqId);
  log.info('fetchDatasetsForCruises', { cruiseIds });
  if (!cruiseIds || cruiseIds.length === 0) {
    return [null, {}];
  }
  const queryString = `
    SELECT Dataset_ID, Cruise_ID FROM tblDataset_Cruises
    WHERE Cruise_ID IN (${cruiseIds.join(', ')})
  `;
  const [err, result] = await makeDataQuery(queryString, reqId, {
    operationName: 'fetch datasets for cruises',
  });

  if (err) {
    return [err];
  } else {
    const map = result.reduce((acc, curr) => {
      const { Dataset_ID, Cruise_ID } = curr;
      if (acc[Cruise_ID]) {
        acc[Cruise_ID].add(Dataset_ID);
      } else {
        acc[Cruise_ID] = new Set([Dataset_ID]);
      }
      return acc;
    }, {});

    return [false, map];
  }
};

const fetchCruise = async (cruiseId, reqId) => {
  const queryString = `
     SELECT * FROM tblCruise
     WHERE ID = ${cruiseId}
  `;
  const operationName = 'fetch cruise';
  const [err, result] = await makeDataQuery(queryString, reqId, {
    operationName,
  });

  let cruise;
  if (result && result.length > 0) {
    cruise = result[0];
  }

  if (err) {
    return [err];
  } else {
    return [false, cruise];
  }
};

// :: [CruiseId] -> [error, { CruiseId: CruiseData }]
const fetchAllCruises = async (cruiseIds, reqId) => {
  const log = moduleLogger.setReqId(reqId);

  let results;
  try {
    results = await Promise.all(cruiseIds.map((id) => fetchCruise(id, reqId)));
  } catch (e) {
    log.error('error fetching cruise data', { error: e });
  }

  const map = {};
  results.forEach(([, cruiseData], index) => {
    if (cruiseData) {
      map[cruiseIds[index]] = cruiseData;
    }
  });

  return [null, map];
};

const randomIntInRange = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const downsampleTrajectory = (trajectoryData, scalingFactor, options) => {
  const { lats, lons, times } = trajectoryData;

  const targetLength = Math.floor(lons.length * scalingFactor);

  // console.log (`target len ${targetLength} (from ${lons.length}) (remove ${lons.length - targetLength})`);

  if (targetLength >= lons.length) {
    return trajectoryData;
  }

  // pick or kick
  const numToRemove = lons.length - targetLength;

  if (numToRemove > lons.length / 2) {
    // pick
    options.timer.add('pick sample of points');
    // create a set of random points, including start and end, to pick from the source array
    const targetIndexes = new Set();
    // make sure to retain start and end points
    targetIndexes.add(0);
    targetIndexes.add(lons.length - 1);

    while (targetIndexes.size < targetLength) {
      targetIndexes.add(randomIntInRange(1, lons.length - 2));
    }

    // create new trajectory data object
    const newTrajectoryData = {
      lats: [],
      lons: [],
      times: [],
    };

    const sortedTargetIndexes = Array.from(targetIndexes).sort((a, b) => {
      return a > b ? 1 : a < b ? -1 : 0;
    });

    // pick points from source and push to new object
    sortedTargetIndexes.forEach((idx) => {
      newTrajectoryData.lats.push(lats[idx]);
      newTrajectoryData.lons.push(lons[idx]);
      newTrajectoryData.times.push(times[idx]);
    });

    return newTrajectoryData;
  } else {
    // kick
    options.timer.add('kick sample of points');

    // create a set of random points, including start and end, to KICK from the source array
    const kickIndexes = new Set();
    while (kickIndexes.size < targetLength) {
      // retain start and end by excluding them from the range
      kickIndexes.add(randomIntInRange(1, lons.length - 2));
    }

    const fullIndexes = new Set(Array.from(Array(lons.length).keys()));
    const keepIndexes = difference(fullIndexes, kickIndexes);

    // create new trajectory data object
    const newTrajectoryData = {
      lats: [],
      lons: [],
      times: [],
    };

    // pick points from source and push to new object
    keepIndexes.forEach((idx) => {
      newTrajectoryData.lats.push(lats[idx]);
      newTrajectoryData.lons.push(lons[idx]);
      newTrajectoryData.times.push(times[idx]);
    });

    return newTrajectoryData;
  }
};

//

function analyzeTrajectory(trajectoryData, options) {
  const { lons, lats } = trajectoryData;

  options.timer.add('analzye trajectory');

  let lonStart = lons[0];
  let latStart = lats[0];
  let maxDistance = 0;

  // Create a new path array each time 180 lon is crossed
  lons.forEach((lon, i) => {
    let lat = lats[i];

    let latDistance = Math.abs(lat - latStart);
    let _lonDistance = Math.abs(lon - lonStart);
    let lonDistance = _lonDistance > 180 ? 360 - _lonDistance : _lonDistance;

    let distance = Math.sqrt(
      latDistance * latDistance + lonDistance * lonDistance,
    );
    maxDistance = distance > maxDistance ? distance : maxDistance;
  });

  const center = [
    lons[Math.floor(lons.length / 2)],
    lats[Math.floor(lons.length / 2)],
  ];

  return {
    center,
    maxDistance,
  };
}

// take a known list of cruise ids and an array of
// trajectory points and munge them into a map
// of { CruiseId: { lats: [], lots: [], times: []} }
// (which is the interface the web app uses for charting trajectories)
// add maxDistance and center values
const assembleTrajectories = (cIds = [], tPts = [], options) => {
  options.timer.add('pre-key trajectory object');
  // console.log ('accumulating trajectories', { cruises: cIds.length, points: tPts.length });

  const ids = new Set();
  tPts.forEach(({ Cruise_ID }) => ids.add(Cruise_ID));

  // const d = difference (new Set(cIds), ids);
  // console.log ('cruises without trajectory points', d);

  // pre-key an object with each cruise id
  const accumulator = Array.from(ids).reduce((acc, curr) => {
    return Object.assign(acc, {
      [curr]: {
        lats: [],
        lons: [],
        times: [],
      },
    });
  }, {});

  options.timer.add('push points into separate objects');
  // accumulate points under appropiriate id
  const trajectoryMap = tPts.reduce((acc, curr) => {
    acc[curr.Cruise_ID].lats.push(curr.lat);
    acc[curr.Cruise_ID].lons.push(curr.lon);
    acc[curr.Cruise_ID].times.push(curr.time);
    return acc;
  }, accumulator);

  // downsampling
  // 1. check total against threshold
  // 2. calculate scaling factor
  // 3. apply scaling factor to each trajectory

  const scalingFactor = TRAJECTORY_POINTS_LIMIT / tPts.length;

  ids.forEach((cId) => {
    if (scalingFactor > 1 && !options.downSample) {
      Object.assign(
        trajectoryMap[cId],
        analyzeTrajectory(trajectoryMap[cId], options),
      );
    } else {
      // scaling factor is > 1 AND downSample is indicated
      const downsampledData = downsampleTrajectory(
        trajectoryMap[cId],
        scalingFactor,
        options,
      );
      trajectoryMap[cId] = Object.assign(
        downsampledData,
        analyzeTrajectory(downsampledData, options),
      );
    }
  });

  return trajectoryMap;
};

const fetchAllTrajectories = async (cruiseIds, reqId, options = {}) => {
  if (!cruiseIds || cruiseIds.length === 0) {
    return [null, {}];
  }
  const timer = debugTimer('fetch trajectories', { mergeSimilar: true });
  timer.start();
  options.timer = timer;
  const log = moduleLogger.setReqId(reqId);

  timer.add('query trajectories');

  const queryString = `SELECT [Cruise_ID], [time], [lat], [lon]
    FROM
        tblCruise_Trajectory
    WHERE
        [Cruise_ID] IN (${cruiseIds.join(',')})
    ORDER BY [Cruise_ID], [time], [lat], [lon]`;
  const operationName = 'fetch cruise trajectories';
  log.info('fetchAllTrajectories', { cruiseIds });
  const [error, result] = await makeDataQuery(queryString, reqId, {
    operationName,
  });
  if (error) {
    return [error];
  }

  if (options.downSample) {
    log.debug('fetch all trajectories called with downsample option');
  } else {
    log.debug('fetch all trajectories: options', { options });
  }

  const map = assembleTrajectories(cruiseIds, result, options);

  const totalPointCount = Object.entries(map).reduce((acc, curr) => {
    const [, data] = curr;
    const { lons } = data;
    return acc + lons.length;
  }, 0);

  log.debug('returning cruise trajectories', { options, totalPointCount });

  timer.done();
  timer.report();
  return [false, map];
};

module.exports = {
  listCruisesForDatasetId,
  cruisesForDatasetList,
  fetchAllCruises,
  fetchAllTrajectories,
  fetchDatasetsForCruises,
};
