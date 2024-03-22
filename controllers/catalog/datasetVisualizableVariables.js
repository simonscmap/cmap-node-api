const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const { getDatasetId } = require("../../queries/datasetId");
const logInit = require("../../log-service");

const moduleLogger = logInit("controllers/catalog/datasetVisualizableVariables");

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
    log.debug ('json stats', { datasetId, stats: result.recordset })
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

// :: shortname -> reqId -> [Error, Data]
const datasetVariables = async (shortname, reqId) => {
  let log = moduleLogger.setReqId (reqId)

  let pool = await pools.dataReadOnlyPool;
  let request = new sql.Request(pool);

  let datasetId = await getDatasetId (shortname, log);

  let [statsErr, stats] = await datasetStats (datasetId, reqId);

  if (statsErr) {
    log.error ('unable to fetch dataset stats', { error: statsErr, shortname, datasetId });
  }

  if (!datasetId) {
    log.error('could not find dataset id for dataset name', { shortname })
    return [{status: 400, message: `no dataset found with name ${shortname}`}];
  }

  let query = `SELECT
                 vars.ID,
                 Table_Name,
                 Short_Name,
                 Temporal_Resolution,
                 Spatial_Resolution,
                 Make,
                 Grid_Mapping,
                 Has_Depth
               FROM tblVariables vars
               JOIN tblTemporal_Resolutions trs on vars.Temporal_Res_ID = trs.ID
               JOIN tblSpatial_Resolutions srs on vars.Spatial_Res_ID = srs.ID
               JOIN tblMakes mks on vars.Make_ID = mks.ID
               WHERE Dataset_ID=${datasetId}
               AND Visualize=1
               ORDER BY Short_Name`;
  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error('error making variable catalog query', { err: e })
    return [{status: 500, message: `error querying dataset variables`, error: e}];
  }

  return [null, { data: result && result.recordset, stats }];
}

module.exports = datasetVariables;
