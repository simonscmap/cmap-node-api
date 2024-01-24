const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const logInit = require("../../log-service");

const moduleLogger = logInit("controllers/catalog/getDatasetStats");

// :: datasetId -> reqId -> [Error, Data]
const datasetStats = async (datasetId, reqId) => {
  const log = reqId ? moduleLogger.setReqId (reqId) : moduleLogger;
  if (!datasetId) {
    log.error ('no dataset id provided', { datasetId });
    return [true];
  }
  const pool = await pools.dataReadOnlyPool;
  const request = new sql.Request(pool);
  const query = `SELECT JSON_stats FROM tblDataset_Stats WHERE Dataset_ID = ${datasetId}`

  let result;
  try {
    result = await request.query(query);
    // log.trace ('json stats', { datasetId, stats: result.recordset })
  } catch (e) {
    return [e];
  }

  if (result && result.recordset && result.recordset[0] && result.recordset[0].JSON_stats) {
    try {
      result = JSON.parse (result.recordset[0].JSON_stats);
    } catch (e) {
      result = null;
    }
  } else {
    result = null;
  }

  return [null, result];
}

module.exports = datasetStats;
