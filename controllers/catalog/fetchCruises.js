const sql = require("mssql");
// const fetchDataset = require('./fetchDataset');
// const nodeCache = require("../../utility/nodeCache");
const pools = require("../../dbHandlers/dbPools");
const { safePath } = require("../../utility/objectUtils");
const { makeDataQuery } = require('../../utility/prepareOnPremQuery');
const logInit = require("../../log-service");
const moduleLogger = logInit("controllers/catalog/getProgramDatasets");

const queryCruisesWithDatasetId = (datasetId) =>
  `SELECT ID FROM tblCruise c
   JOIN tblDataset_Cruises dc ON c.ID = dc.Cruise_ID
   WHERE dc.Dataset_ID = ${datasetId}`;

// :: datasetId -> [error, [CruiseId]]
const listCruisesForDatasetId = async (datasetId, reqId) => {
  const log = moduleLogger.setReqId (reqId);
  const queryString = queryCruisesWithDatasetId (datasetId);
  const operationName = 'list cruises for dataset'

  const [err, result, fullResp] = await makeDataQuery (queryString, reqId, {
    operationName
  });

  if (err) {
    return [err];
  }

  if (result && result.length) {
    const transformedResult = result.map(({ ID }) => ID );
    return [null, transformedResult];
  } else {
    return [new Error ('no records returned')]
  }
}


const cruisesForDatasetList = async (datasetIds, reqId) => {
  const log = moduleLogger.setReqId (reqId);

  let results;
  try {
    results = await Promise.all (datasetIds.map ((id) =>
      listCruisesForDatasetId (id, reqId)));
  } catch (e) {
    log.error ('error while fetching curises for dataset list', { error: e })
  }

  const map = {};
  const list = new Set();
  results.forEach (([, cruiseData], index) => {
    if (cruiseData) {
      map[datasetIds[index]] = cruiseData;
      cruiseData.forEach ((item) => list.add(item));
    }
  });

  return [null, { map, list: Array.from(list) }];
};


const fetchCruise = async (cruiseId, reqId) => {
  const queryString = `
     SELECT * FROM tblCruise
     WHERE ID = ${cruiseId}
  `;
  const operationName = 'fetch cruise'
  const [err, result] = await makeDataQuery (queryString, reqId, {
    operationName
  });

  let cruise;
  if (result && result.length > 0) {
    cruise = result[0];
  }

  if (err) {
    return [err]
  } else {
    return [false, cruise];
  }
};

// :: [CruiseId] -> [error, { CruiseId: CruiseData }]
const fetchAllCruises = async (cruiseIds, reqId) => {
  const log = moduleLogger.setReqId (reqId);

  let results;
  try {
    results = await Promise.all (cruiseIds.map ((id) =>
      fetchCruise (id, reqId)));
  } catch (e) {
    log.error ('error fetching cruise data', { error: e })
  }

  const map = {};
  results.forEach (([, cruiseData], index) => {
    if (cruiseData) {
      map[cruiseIds[index]] = cruiseData;
    }
  });

  return [null, map];
}

//

function analyzeTrajectory (trajectoryData) {
    const { lons, lats } = trajectoryData;

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
      lats[Math.floor(lons.length / 2)]
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
const mapTrajectories = (cIds = [], tPts = []) => {
  const accumulator = cIds.reduce((acc, curr) => {
    return Object.assign(acc, {
      [curr]: {
        lats: [],
        lons: [],
        times: [],
      }
    });
  }, {});

  const trajectoryMap = tPts.reduce((acc, curr) => {
    acc[curr.Cruise_ID].lats.push(curr.lat);
    acc[curr.Cruise_ID].lons.push(curr.lon);
    acc[curr.Cruise_ID].times.push(curr.time);
    return acc;
  }, accumulator);

  Object.keys(trajectoryMap).forEach ((cId) => {
    Object.assign(trajectoryMap[cId], analyzeTrajectory(trajectoryMap[cId]));
  });

  return trajectoryMap;
};

const fetchAllTrajectories = async (cruiseIds, reqId, options = {}) => {
  const log = moduleLogger.setReqId (reqId);

  const queryString = `SELECT [Cruise_ID], [time], [lat], [lon]
    FROM
        tblCruise_Trajectory
    WHERE
        [Cruise_ID] IN (${cruiseIds.join(',')})
    ORDER BY [Cruise_ID], [time], [lat], [lon]`;
  const operationName = 'fetch cruise trajectories';

  const [error, result] = await makeDataQuery(queryString, reqId, { operationName });
  if (error) {
    return [error];
  }

  if (options.downSample) {
    log.debug('fetch all trajectories called with downsample option')
  } else {
    log.debug ('fetch all trajectories: options', { options })
  }

  const map = mapTrajectories (cruiseIds, result);

  return [false, map];
}

module.exports = {
  listCruisesForDatasetId,
  cruisesForDatasetList,
  fetchAllCruises,
  fetchAllTrajectories,
};
