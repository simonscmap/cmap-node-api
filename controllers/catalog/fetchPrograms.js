const sql = require("mssql");
const fetchDataset = require('./fetchDataset');
const nodeCache = require("../../utility/nodeCache");
const pools = require("../../dbHandlers/dbPools");
const { safePath } = require("../../utility/objectUtils");
const logInit = require("../../log-service");
const moduleLogger = logInit("controllers/catalog/getProgramDatasets");

const TEMP_TABLE = {
  'Test': [156,157,238]
};


// :: () -> [error, [Program] ]
// Program :: { id, name }
const listPrograms = async (reqId) => {
  const log = moduleLogger.setReqId (reqId);
  const pool = await pools.dataReadOnlyPool;
  const request = new sql.Request(pool);
  let response;
  try {
    response = await request.query(`SELECT * FROM tblPrograms`);
  } catch (e) {
    log.error ('error retrieving programs', { error: e });
    return [e];
  }

  const result = safePath (['recordset']) (response);

  if (result && result.length) {
    const transformedResult = result
    .filter (({ Program_Name }) => Program_Name !== 'NA')
    .map (({ Program_ID, Program_Name }) => ({
      id: Program_ID,
      name: Program_Name
    }));
    return [null, transformedResult];
  } else {
    return [new Error ('no records returned')]
  }
}

// :: programName -> [datasetId]
const getDatasetIdsByProgramName = async (programName, reqId) => {
  const log = moduleLogger.setReqId (reqId);

  const maybeData = TEMP_TABLE[programName];
  if (maybeData) {
    log.debug ('returning test data for program', programName);
    return maybeData;
  }

  const pool = await pools.dataReadOnlyPool;
  const request = new sql.Request(pool);

  let response;
  try {
    response = await request.query(`
      SELECT Dataset_ID FROM tblDataset_Programs dp
      JOIN tblPrograms p ON p.Program_ID = dp.Program_ID
      WHERE p.Program_Name = '${programName}'`);
  } catch (e) {
    log.error ('error retrieving program datasets', { error: e });
    return [e];
  }

  const result = safePath (['recordset']) (response);

  if (Array.isArray(result)) {
    const transformedResults = result.map (({ Dataset_ID }) => Dataset_ID);
    return [false, transformedResults];
  } else {
    return [new Error ('no results returned')]
  }
}

// :: [id] -> [err, [Dataset]]
const getAllDatasets = async (datasetIds, reqId) => {
  const log = moduleLogger.setReqId (reqId);

  if (!Array.isArray (datasetIds)) {
    log.error ('received wrong argument to getAllDatasets')
    return [new Error ('wrong argument type')];
  }

  const opt = { useNewDatasetModel: true };
  let results;
  try {
    results = await Promise.all (datasetIds.map ((id) =>
      fetchDataset ({ id }, opt)));
  } catch (e) {
    log.error ('error fetching program dataset data', {
      datasetIds,
      error: e
    });
    return [e];
  }

  const map = {};
  results.forEach (([err, data], index) => {
    if (err) {
      log.error ('error while fetching dataset for program', {
        datasetId: datasetIds[index],
        error: err,
      })
    }
    if (data) {
      map[data.ID] = data;
    }
  })

  return [null, map];
};


module.exports = {
  listPrograms,
  getDatasetIdsByProgramName,
  getAllDatasets,
};
