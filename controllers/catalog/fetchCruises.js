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

  const map = {};
  if (Array.isArray (result) && result.length) {
    const points = result;
    points.forEach ((point) => {
      const { Cruise_ID, time, lat, lon } = point;
      if (Array.isArray (map[Cruise_ID])) {
        map[Cruise_ID].push ({ time, lat, lon });
      } else {
        map[Cruise_ID] = [{ time, lat, lon }];
      }
    });
  }

  return [false, map];
}

module.exports = {
  listCruisesForDatasetId,
  cruisesForDatasetList,
  fetchAllCruises,
  fetchAllTrajectories,
};
