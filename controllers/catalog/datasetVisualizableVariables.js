const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const { getDatasetId } = require("../../queries/datasetId");
const logInit = require("../../log-service");
const getMinDepth = require("./getMinDepth");
const getDatasetStats = require('./getDatasetStats');

const SPARSE_DATA_QUERY_MAX_SIZE = 10000;

const moduleLogger = logInit("controllers/catalog/datasetVisualizableVariables");

const isGriddedData = (v) => Boolean (v.Temporal_Resolution)
                        && Boolean (v.Spatial_Resolution)
                        && v.Temporal_Resolution !== 'Irregular'
                        && v.Spatial_Resolution !== 'Irregular';


const isHourlyTRes = (v) => Boolean (v.Temporal_Resolution)
                     && v.Temporal_Resolution === 'Hourly';

const isGriddedAndHasDepth = (v) =>
  v.Has_Depth && isGriddedData (v);

// take variable info and its dataset's stats and provide a normalized reference
const munge = (variable, datasetStats, targetDepthRange) => {
  moduleLogger.trace (`munge received targetDepthRange`, targetDepthRange);
  const s = datasetStats;

  // handle case where the temporal resolution of a gridded dataset is hourly
  // and we need to get both time and hour fields
  const needHourField = isGriddedData (variable) && isHourlyTRes (variable);

  const depth1 = targetDepthRange[0] || (s.depth && s.depth.min) || 0;
  const depth2 = targetDepthRange[1] || (s.depth && s.depth.min) || 0;

  // console.log (s); // stats
  return {
    metadata: {
      Depth_Max: s.depth ? s.depth.max : 0,
      Short_Name: variable.Short_Name,
      Long_Name: variable.Long_Name,
      Temporal_Resolution: variable.Temporal_Resolution,
      Spatial_Resolution: variable.Spatial_Resolution,
      Table_Name: variable.Table_Name,
      Unit: variable.Unit,
      targetDepthRange,
    },
    parameters: {
      dt1: s.time.max,
      dt2: s.time.max,
      lat1: s.lat.min,
      lat2: s.lat.max,
      lon1: s.lon.min,
      lon2: s.lon.max,
      depth1,
      depth2,
      fields: variable.Short_Name,
      secondaryField: needHourField ? 'hour' : undefined,
      tableName: variable.Table_Name,
    }
  };
};

// Helpers

const getDatasetParametersFromVariablesAndStats = (datasetId, variables, stats) => {
  let tableName;
  const tableNames = Array.from (new Set (variables.map (v => v.Table_Name)));
  if (tableNames.length > 1) {
    moduleLogger.warn ('dataet exists in more than one table', { datasetId, tableNames });
    tableName = tableNames[0];
  } else {
    tableName = tableNames[0];
  }

  return {
    tableName,
    tableNames,
    time: stats.time.max,
    latMin: stats.lat.min,
    lonMin: stats.lon.min,
  };
};


const someVarsAreGriddedAndHaveDepth = (vars) => vars.some (isGriddedAndHasDepth);

const getVisType = (v) => {
  const visType = isGriddedData (v) ? 'Heatmap' : 'Sparse';
  // factor in whether a gridded dataset is hourly, because this will
  // need to be a custom query; the stored procedure will not add the hour field needed
  const queryType = visType === 'Sparse'
                  ? 'query'
                  : (visType === 'Heatmap' && isHourlyTRes (v))
                  ? 'query'
                  : 'sp';

  return { visType, queryType };
}

const addMetaData = (stats, targetDepthRange) => (v) => {
  const { visType, queryType } = getVisType(v);
  const { parameters, metadata } = munge (v, stats, targetDepthRange);

  return Object.assign ({}, v, { meta: {
    visType,
    queryType,
    // query,
    parameters,
    metadata,
  }});
};


// :: shortname -> reqId -> [Error, Data]
const datasetVariables = async (shortname, reqId) => {
  let log = moduleLogger.setReqId (reqId)
  let pool = await pools.dataReadOnlyPool;
  let request = new sql.Request(pool);

  // get id from shortname
  let datasetId = await getDatasetId (shortname, log);

  if (!datasetId) {
    log.error('could not find dataset id for dataset name', { shortname })
    return [{status: 400, message: `no dataset found with name ${shortname}`}];
  }

  // get dataset stats
  let [statsErr, stats] = await getDatasetStats (datasetId, reqId);

  if (statsErr) {
    log.error ('unable to fetch dataset stats', { error: statsErr, shortname, datasetId });
  }


  // get dataset variables, filtered by Visualize=1
  let query = `SELECT
                 vars.ID,
                 Table_Name,
                 Short_Name,
                 Long_Name,
                 Temporal_Resolution,
                 Spatial_Resolution,
                 Make,
                 Has_Depth,
                 vars.Unit
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
    if (!result || !result.recordset || !Array.isArray(result.recordset)) {
      return [{status: 404, message: 'no data was returned'}];
    }
  } catch (e) {
    log.error('error making variable catalog query', { err: e })
    return [{status: 500, message: `error querying dataset variables`, error: e}];
  }

  // in order to construct a query with a depth constraint that will only include
  // the first actual depth level
  let targetDepthRange = [];
  if (someVarsAreGriddedAndHaveDepth (result.recordset)) {
    const getDepthArgs = getDatasetParametersFromVariablesAndStats (datasetId, result.recordset, stats);
    let [depthError, top2Depths] = await getMinDepth (getDepthArgs);
    if (depthError) {
      log.error ('error fetching min depth', depthError);
      return [{ status: 500, message: 'could not establish depth range', error: depthError }];
    } else if (Array.isArray (top2Depths)) {
      const [dp1, dp2] = top2Depths;
      if (!dp1 || !dp2)  {
        log.warn ('could not provide depth range', { dp1, dp2 });
        return [{status: 500, message: 'unexpected result when querying depths'}];
      } else {
        const midpoint = (dp1 + dp2) / 2;
        targetDepthRange.push (0);
        targetDepthRange.push (midpoint);
      }
    } else {
      log.error ('unexpected result for depths', { top2Depths });
      return [{status: 500, message: 'unexpected result when querying depths'}];
    }
  }

  // emend variables with preformed query and plot type
  const variables = result.recordset.map (addMetaData (stats, targetDepthRange));

  return [null, { variables, stats }];
}

module.exports = datasetVariables;
