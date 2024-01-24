const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const { getDatasetId } = require("../../queries/datasetId");
const logInit = require("../../log-service");

const moduleLogger = logInit("controllers/catalog/datasetVariables");

// :: shortname -> reqId -> [Error, Data]
const datasetUSPVariableCatalog = async (shortname, reqId) => {
  let log = moduleLogger.setReqId (reqId)

  let pool = await pools.dataReadOnlyPool;
  let request = new sql.Request(pool);

  let datasetId = await getDatasetId (shortname, log);

  if (!datasetId) {
    log.error('could not find dataset id for dataset name', { shortname })
    return [{status: 400, message: `no dataset found with name ${shortname}`}];
  }

  let query = `EXEC uspVariableCatalog ${datasetId}`;
  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error('error making variable catalog query', { err: e })
    return [{status: 500, message: `error querying dataset variables`, error: e}];
  }

  const data = result && result.recordset;
  return [null, data];
}

module.exports = datasetUSPVariableCatalog;
