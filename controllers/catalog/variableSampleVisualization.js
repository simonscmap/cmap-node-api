const sql = require("mssql");
const getDatasetVisualizableVariables = require ('./datasetVisualizableVariables');
const queryHandler = require("../../utility/queryHandler");
const dateUtils = require ("../../utility/dateUtils");
const logInit = require("../../log-service");
const moduleLogger = logInit("controllers/catalog/variableSampleVisualization");
const pools = require("../../dbHandlers/dbPools");
const getCountForSample = require("./getCountForSample")

const sparseDataQueryFromPayload = (parameters, metadata) => {
  let { fields, secondaryField: sf } = parameters;

  let secondaryField = sf ? sf : '';

  let depthSelectPart = metadata.Has_Depth ? 'depth' : '';
  let otherFields = [depthSelectPart, fields, secondaryField]
    .filter (f => !!f.length)
    .join (', ');

  let depthOrderPart = metadata.Has_Depth ? ', depth' : '';

  const SPARSE_DATA_QUERY_MAX_SIZE = 10000; // 10k
  let query = `SELECT TOP ${SPARSE_DATA_QUERY_MAX_SIZE} time, lat, lon, ${otherFields} FROM ${parameters.tableName} WHERE ${fields} IS NOT NULL ORDER BY time desc, lat, lon${depthOrderPart}`;

  return {
    queryString: query,
  };
};

const storedProcedureUri = (parameters) => {
  const params = Object.assign ({}, parameters, { spName: 'uspSpaceTime' });
  const queryString = Object.keys(params).reduce((queryString, key, i) => {
    return `${queryString}${i === 0 ? '' : '&'}${key}=${params[key]}`;
  }, '');
  return {
    queryString,
    params,
  }
};

const getGriddedWithHourlyQuery = (variableData) => {
  const { meta, Has_Depth, Table_Name, Short_Name } = variableData;
  const { dt1, dt2, lat1, lat2, lon1, lon2 } = meta.parameters;
  const { targetDepthRange } = meta.metadata;

  const primaryField = Short_Name;

  // const otherFields = `${primaryField}, hour`

  // NOTE: for the sample vis we don't need the hour field
  // because we only visualize a single slice of time
  // but in a full visualization context, in which we might average
  // values across time slices (Heatmap) then we would need to include it
  // But there is a chance that the data model that is created by the client with this data
  // expects the hour field to be in a different location in the row.


  const date1 = dateUtils.toDateString (dt1);
  const date2 = dateUtils.toDateString (dt2);

  const dateConstraint = `time BETWEEN '${date1}' and '${date2}'`;
  const hourConstraint = `hour = '12'`;
  const latConstraint = `lat BETWEEN ${lat1} and ${lat2}`;
  const lonConstraint = `lon BETWEEN ${lon1} and ${lon2}`;
  const depthConraint = (Has_Depth && targetDepthRange.length === 2)
                      ? `depth BETWEEN ${targetDepthRange[0]} and ${targetDepthRange[1]}`
                      : '';
  const depthOrderTerm = Has_Depth ? ', depth' : '';

  const constraints = [dateConstraint, hourConstraint, latConstraint, lonConstraint];

  if (depthConraint.length > 0) {
    constraints.push (depthConraint);
  }

  const constraintString = constraints.join (' AND ');

  return `SELECT time, lat, lon, hour, ${primaryField} from ${Table_Name}
          WHERE ${primaryField} IS NOT NULL
          AND ${constraintString}
          ORDER BY time, lat, lon ${depthOrderTerm}`;
}

const restrictSpatialParameters = (params) => {
  return Object.assign ({}, params, {
    lat1: 14.071,
    lat2: 63.102,
    lon1: -91.231,
    lon2: 10.747,
  });
}

const constructQuery = (variableData, latCount) => {
  const { parameters, metadata, queryType } = variableData.meta;
  const oneMillionOneHundredThousand = 1100000;

  const shouldRestrictSpatialParams = queryType === 'sp' && latCount > oneMillionOneHundredThousand;

  const newParameters = shouldRestrictSpatialParams
                      ? restrictSpatialParameters (parameters)
                      : parameters;

  const newVariableData = Object.assign ({}, variableData);
  newVariableData.meta.parameters = newParameters;

  if (queryType === 'sp') {
    if (parameters.secondaryField === 'hour') {
      return {
        routeTo: 'query',
        query: getGriddedWithHourlyQuery (newVariableData)
      }
    } else {
      return {
        routeTo: 'sp',
        params: storedProcedureUri (newParameters).params,
      }
    }
  } else if (queryType === 'query') {
    return {
      routeTo: 'query',
      query: sparseDataQueryFromPayload (parameters, metadata).queryString,
    }
  } else {
    moduleLogger.error ('missing query type', { variable: variableData })
    return {};
  }
};

// fetch sproc query: helper that calls a sproc endpoint
// with a flag that will cause the sql server to respond with
// an ansi compliant query that can be run on prem or on cluster
// :: [error?, queryString, message?];

// NOTE: this function was copied from its controller in data/index.js due to importing it causing a circular dependency
const fetchSprocQuery = async (reqId, spExecutionQuery, argSet) => {
  let log = moduleLogger.setReqId (reqId);
  let pool = await pools.dataReadOnlyPool;
  let request = new sql.Request(pool);
  let result;

  try {
    result = await request.query(spExecutionQuery);
  } catch (e) {
    log.error('error fetching sproc statement', { error: e, query: spExecutionQuery });
    return [true, null, 'error fetching sproc statement']
  }

  if (result && result.recordset && result.recordset.length && result.recordset[0] && result.recordset[0].query) {
    log.info('sproc call returned query', { argSet, result: result.recordset[0].query });
    spExecutionQuery = result.recordset[0].query;
    return [false, spExecutionQuery];
    // req.cmapApiCallDetails.query = spExecutionQuery;
    /// queryHandler(req, res, next, spExecutionQuery);
  } else {
    log.error('error fetching sproc statement: no result', { query: spExecutionQuery, result });
    return [true, null, 'error fetching sproc statement'];
  }
};

// NOTE: this only serves the subset of stored procedures that power the chart visualizations
// NOTE: this function was copied from the stored procedure controller in data/index.js due to importing it causing a circular dependency
const storedProcedure = async (req, res, next) => {
  console.log ('calling stored procedure controller');
  let log = moduleLogger.setReqId(req.requestId);
  let argSet = req.query;

  log.info("stored procedure call", { ...argSet });
  console.log (argSet.fields, argSet.tableName);

  let spExecutionQuery;

  let fields = argSet.fields.replace(/[[\]']/g, "");
  let tableName = argSet.tableName.replace(/[[\]']/g, "");

  // NOTE the `1` as the last argument, which optionally sets the return value to be the SELECT statement
  // to be run
  spExecutionQuery = `EXEC ${argSet.spName} '[${tableName}]', '[${fields}]', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}', 1`;

  log.info ('fetching query for stored procedure', { sproc: spExecutionQuery });

  let [error, q, message] = await fetchSprocQuery (req.requestId, spExecutionQuery, req.query);
  // NOTE: if there has been an error, it has been logged in fechSprocQuery
  if (error) {
    return next(message);
  } else {
    await queryHandler(req, res, next, q);
    return next();
  }

};

// route handler
const sampleVis = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId)
  const { varId, shortname } = req.query;
  const { requestId } = req;

  log.info ('preparing sample visualization', { variableId: varId, datasetShortName: shortname })

  // get dataset info
  const [e, data] = await getDatasetVisualizableVariables ({ shortname }, requestId);
  if (e) {
    log.error ('get dataset vis vars failed', { error: e });
    res.status (e.status).send (e.message);
    return next(e);
  }

  const { variables } = data;
  const selectedVariable = variables.find ((v) => ('' + v.ID === varId));

  if (!selectedVariable) {
    log.error ('could not find variable in dataset variables', { variables, varId })
    res.status (400).send ('could not find variable in dataset variables');
    return next(e);
  }

  let latCount;
  if (selectedVariable.meta.queryType === 'sp') {
    const [countErr, countResult] = await getCountForSample (selectedVariable);
    if (countErr) {
      log.error (countErr.message, selectedVariable);
      res.status (countErr.status, countErr.message);
      return next (countErr);
    } else {
      latCount = countResult;
    }
  } else {
    log.debug ('skipping sample count', selectedVariable)
  }

  // decide what kind of query to run
  const { routeTo, query, params } = constructQuery (selectedVariable, latCount);


  console.log ('QUERY', routeTo, query, params);
  // delegate

  if (routeTo === 'query') {
    queryHandler (req, res, next, query);
  } else if (routeTo === 'sp') {
    req.query = params;
    storedProcedure (req, res, next);
  } else {
    log.error ('could not resolve query type', { variables, varId })
    res.status (400).send ('could not resolve query type');
    return next(true);
  }
}

module.exports = sampleVis;
