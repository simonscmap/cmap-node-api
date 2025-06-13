const sql = require('mssql');
const fetchDataset = require('./fetchDataset');
const datasetVisualizableVariables = require('./datasetVisualizableVariables');
// const nodeCache = require("../../utility/nodeCache");
const pools = require('../../dbHandlers/dbPools');
const { safePath } = require('../../utility/objectUtils');
const logInit = require('../../log-service');
const moduleLogger = logInit('controllers/catalog/getProgramDatasets');
const cacheAsync = require('../../utility/cacheAsync');

// :: () -> [error, [Program] ]
// Program :: { id, name }
const listPrograms = async (reqId) => {
  const log = moduleLogger.setReqId(reqId);
  const pool = await pools.dataReadOnlyPool;
  const request = new sql.Request(pool);
  let response;
  try {
    response = await request.query(`SELECT * FROM tblPrograms`);
  } catch (e) {
    log.error('error retrieving programs', { error: e });
    return [e];
  }

  const result = safePath(['recordset'])(response);

  if (result && result.length) {
    const transformedResult = result
      .filter(({ Program_Name }) => Program_Name !== 'NA')
      .map(({ Program_ID, Program_Name }) => ({
        id: Program_ID,
        name: Program_Name,
      }));
    return [null, transformedResult];
  } else {
    return [new Error('no records returned')];
  }
};

// :: programName -> [datasetId]
const getDatasetIdsByProgramName = async (programName, reqId) => {
  const log = moduleLogger.setReqId(reqId);

  const pool = await pools.dataReadOnlyPool;
  const request = new sql.Request(pool);

  let response;
  try {
    response = await request.query(`
      SELECT Dataset_ID FROM tblDataset_Programs dp
      JOIN tblPrograms p ON p.Program_ID = dp.Program_ID
      WHERE p.Program_Name = '${programName}'`);
  } catch (e) {
    log.error('error retrieving program datasets', { error: e });
    return [e];
  }

  const result = safePath(['recordset'])(response);

  if (Array.isArray(result)) {
    const transformedResults = result.map(({ Dataset_ID }) => Dataset_ID);
    return [false, transformedResults];
  } else {
    return [new Error('no results returned')];
  }
};

// :: () -> { Dataset_ID: Set<Program_ID> }
const getCrossOverDatasets = async (reqId) => {
  const log = moduleLogger.setReqId(reqId);

  const pool = await pools.dataReadOnlyPool;
  const request = new sql.Request(pool);

  let response;
  try {
    response = await request.query(`
      SELECT * FROM tblDataset_Programs
      WHERE Dataset_ID IN (
        SELECT Dataset_ID FROM tblDataset_Programs
        GROUP BY Dataset_ID
        HAVING COUNT(Dataset_ID) >= 2
      )`);
  } catch (e) {
    log.error('error retrieving crossover datasets', { error: e });
    return [e];
  }

  const result = safePath(['recordset'])(response);

  if (Array.isArray(result)) {
    const datasetsProgramsByDatasetId = result.reduce((acc, curr) => {
      if (!curr) {
        return acc;
      }
      const { Dataset_ID, Program_ID } = curr;

      if (acc[Dataset_ID] && acc[Dataset_ID].add) {
        acc[Dataset_ID].add(Program_ID);
      } else {
        acc[Dataset_ID] = new Set([Program_ID]);
      }
      return acc;
    }, {});

    return [false, datasetsProgramsByDatasetId];
  } else {
    return [new Error('no results returned')];
  }
};

const oneDayInSeconds = 60 * 60 * 24;
const cacheOptions = { ttl: oneDayInSeconds };
const getCrossOverDatasetsWithCache = async () => {
  const result = await cacheAsync(
    'CROSS_OVER_PROGRAM_DATASETS',
    getCrossOverDatasets,
    cacheOptions,
  );
  return [Boolean(result), result];
};

const getAllDatasetShortNames = async (datasetIds, reqId) => {
  const log = moduleLogger.setReqId(reqId);

  if (!Array.isArray(datasetIds)) {
    log.error('received wrong argument to getAllDatasetShortNames');
    return [new Error('wrong argument type')];
  }
  if (datasetIds.length === 0) {
    return [null, {}];
  }
  const pool = await pools.dataReadOnlyPool;
  const request = new sql.Request(pool);

  let response;
  log.info('getAllDatasetShortNames', { datasetIds });
  try {
    response = await request.query(`
      SELECT ID, Dataset_Name FROM tblDatasets
      WHERE ID IN (${datasetIds.join(',')})`);
  } catch (e) {
    log.error('error retrieving supplemental dataset names', { error: e });
    return [e];
  }

  const result = safePath(['recordset'])(response);
  if (!result) {
    return [true, null];
  } else {
    const returnValue = result.reduce((acc, curr) => {
      acc[curr.ID] = curr.Dataset_Name;
      return acc;
    }, {});

    console.log(returnValue);
    return [false, returnValue];
  }
};

// :: [id] -> [err, [Dataset]]
const getAllDatasets = async (datasetIds, reqId) => {
  const log = moduleLogger.setReqId(reqId);

  if (!Array.isArray(datasetIds)) {
    log.error('received wrong argument to getAllDatasets');
    return [new Error('wrong argument type')];
  }

  const opt = { useNewDatasetModel: true };
  let results; // array of [Error, Data] tuples
  try {
    results = await Promise.all(
      datasetIds.map((id) => fetchDataset({ id }, opt)),
    );
  } catch (e) {
    log.error('error fetching program dataset data', {
      datasetIds,
      error: e,
    });
    return [e];
  }

  let variableResults; // array of [Error, Data] tuples
  try {
    variableResults = await Promise.all(
      datasetIds.map((id) => datasetVisualizableVariables({ id }, reqId)),
    );
  } catch (e) {
    log.error('error fetching program dataset visualizable variables', {
      datasetIds,
      error: e,
    });
    return [e];
  }

  const map = {};
  results.forEach(([err, data], index) => {
    if (err) {
      log.error('error while fetching dataset for program', {
        datasetId: datasetIds[index],
        error: err,
      });
    }
    if (data) {
      // get associated visualizable variables
      const [matchingVariables] = variableResults
        .filter(([, vData]) => {
          return vData && vData.datasetId === datasetIds[index];
        })
        .map(([, matching]) => matching);

      Object.assign(data, { visualizableVariables: matchingVariables });

      // add dataset to map
      map[data.ID] = data;
    }
  });

  return [null, map];
};

module.exports = {
  listPrograms,
  getDatasetIdsByProgramName,
  getAllDatasets,
  getAllDatasetShortNames,
  getCrossOverDatasets,
  getCrossOverDatasetsWithCache,
};
