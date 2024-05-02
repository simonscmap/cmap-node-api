const sql = require("mssql");
const S = require("../../utility/sanctuary");
const pools = require("../../dbHandlers/dbPools");
const { getDatasetId } = require("../../queries/datasetId");
const logInit = require("../../log-service");
const getMinDepth = require("./getMinDepth");
const getDatasetStats = require('./getDatasetStats');
const getHasHourField = require("./getHasHourField");
const { safePath } = require("../../utility/objectUtils");


const moduleLogger = logInit("controllers/catalog/datasetVisualizableVariables");

const isGriddedData = (v) => Boolean (v.Temporal_Resolution)
                        && Boolean (v.Spatial_Resolution)
                        && v.Temporal_Resolution !== 'Irregular'
                        && v.Spatial_Resolution !== 'Irregular';


const isHourlyTRes = (v) => Boolean (v.Temporal_Resolution)
                     && v.Temporal_Resolution === 'Hourly';

const isMonthlyClimatology = (v) => Boolean(v.Climatology);

const isGriddedAndHasDepth = (v) =>
  v.Has_Depth && isGriddedData (v);

const replaceZToken = (dateString) => {
  if (typeof dateString !== 'string' || !dateString.replace) {
    return dateString;
  }

  return dateString.replace ('Z', '');
}

// take variable info and its dataset's stats and provide a normalized reference
const munge = (variable, datasetStats, targetDepthRange, needsHourField) => {
  const s = datasetStats;

  const {
    Short_Name,
    Long_Name,
    Temporal_Resolution,
    Spatial_Resolution,
    Table_Name,
    Unit,
    Has_Depth,
  } = variable;

  // handle case where the temporal resolution of a gridded dataset is hourly
  // and we need to get both time and hour fields

  const depth1 = targetDepthRange[0] || (s.depth && s.depth.min) || 0;
  const depth2 = targetDepthRange[1] || (s.depth && s.depth.min) || 0;

  const timeMax = safePath (['time','max']) (s);

  const month1 = 1;

  const monthly = isMonthlyClimatology (variable);
  // const hourly = (needsHourField && isHourlyTRes (variable));
  // console.log ('needsHourField', needsHourField, Temporal_Resolution);

  const date1 = monthly ? `${month1}-01-1900` : timeMax;
  const date2 = monthly ? `${month1}-01-1900` : timeMax;

  const result = {
    metadata: {
      Short_Name,
      Long_Name,
      Temporal_Resolution,
      Spatial_Resolution,
      Table_Name,
      Unit,
      Has_Depth,
      Depth_Max: s.depth ? s.depth.max : 0,
      targetDepthRange,
      count: safePath ([Short_Name, 'count']) (s)
    },
    parameters: {
      dt1: replaceZToken (date1),
      dt2: replaceZToken (date2),
      lat1: s.lat.min,
      lat2: s.lat.max,
      lon1: s.lon.min,
      lon2: s.lon.max,
      depth1,
      depth2,
      fields: Short_Name,
      secondaryField: (needsHourField && isHourlyTRes (variable)) ? 'hour' : undefined,
      tableName: Table_Name,
    }
  };

  return result;
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
    time: safePath (['time', 'max']) (stats),
    latMin: stats.lat.min,
    lonMin: stats.lon.min,
  };
};


const someVarsAreGriddedAndHaveDepth = (vars) => vars.some (isGriddedAndHasDepth);

const someVarsAreHourly = (vars) => vars.some (isHourlyTRes);

const getVisType = (v) => {
  const visType = isGriddedData (v) ? 'Heatmap' : 'Sparse';
  // NOTE we indicate sp even in cases where we will need to write a custom query
  // to handle the hour field (and not use uspSpaceTime)
  // however, it is more "correct" to use the sp designation to indicate that it
  // is a gridded dataset that requires a space-time-like query
  // The signal to the query generator is that in parameters will indicate 'hour'
  // as a secondary time field
  // see variableSampleVisualization.js
  const queryType = visType === 'Sparse'
                  ? 'query'
                  : 'sp';

  return { visType, queryType };
}

const addMetaData = (metaArgs) => (v) => {
  const { stats, targetDepthRange, needsHourField } = metaArgs;
  const { visType, queryType } = getVisType(v);
  const { parameters, metadata } = munge (v, stats, targetDepthRange, needsHourField);

  return Object.assign ({}, v, { meta: {
    visType,
    queryType,
    // query,
    parameters,
    metadata,
  }});
};


// :: shortname -> reqId -> [Error, Data]
const datasetVariables = async ({ shortname, id }, reqId) => {
  let log = moduleLogger.setReqId (reqId)
  let pool = await pools.dataReadOnlyPool;
  let request = new sql.Request(pool);

  // console.log ('method', shortname, id)

  // get id from shortname
  let datasetId;
  if (!id && shortname) {
    datasetId = await getDatasetId (shortname, log);
  } else {
    datasetId = id;
  }

  if (!datasetId) {
    log.error('could not find dataset id for dataset name', { shortname, id })
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

                 Sensor,
                 Make,
                 Has_Depth,
                 vars.Unit,
                 Climatology
               FROM tblVariables vars
               JOIN tblTemporal_Resolutions trs on vars.Temporal_Res_ID = trs.ID
               JOIN tblSpatial_Resolutions srs on vars.Spatial_Res_ID = srs.ID
               JOIN tblMakes mks on vars.Make_ID = mks.ID
               JOIN tblSensors sns on vars.Sensor_ID = sns.ID
               JOIN tblDatasets dsets on vars.Dataset_ID = dsets.ID
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
    const variablesWithDepth = result.recordset.filter (v => v.Has_Depth);
    const getDepthArgs = getDatasetParametersFromVariablesAndStats (
      datasetId,
      variablesWithDepth,
      stats
    );
    let [depthError, top2Depths] = await getMinDepth (getDepthArgs);
    if (depthError) {
      log.error ('error fetching min depth', depthError);
      return [{ status: 500, message: 'could not establish depth range', error: depthError }];
    } else if (Array.isArray (top2Depths)) {
      const [dp1, dp2] = top2Depths;
      if (isNaN(dp1) || isNaN(dp2))  {
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

  let needsHourField = false;
  if (someVarsAreHourly(result.recordset)) {
    const variablesWithHourly = result.recordset.filter (v => v.Temporal_Resolution === 'Hourly');
    const hourlyArgs = getDatasetParametersFromVariablesAndStats (
      datasetId,
      variablesWithHourly,
      stats
    );

    const [hErr, hasHourField] = await getHasHourField (hourlyArgs);
    if (hErr) {
      log.error ('getHasHour encountered an error', hErr);
    }

    if (hasHourField) {
      needsHourField = true;
    }
  }

  const metaArgs = {
    stats,
    targetDepthRange,
    needsHourField,
  }


  // emend variables with preformed query and plot type
  const variables = result.recordset.map (addMetaData (metaArgs));


  return [null, { variables, stats, datasetId }];
}

module.exports = datasetVariables;
