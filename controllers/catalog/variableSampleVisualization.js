const getDatasetVisualizableVariables = require ('./datasetVisualizableVariables');
const queryHandler = require("../../utility/queryHandler");
const logInit = require("../../log-service");
const moduleLogger = logInit("controllers/catalog/variableSampleVisualization");
const pools = require("../../dbHandlers/dbPools");
const sql = require("mssql");

const sparseDataQueryFromPayload = (parameters, metadata) => {
  let { fields, secondaryField: sf } = parameters;
  let secondaryField = sf ? sf : '';

  let depthSelectPart = metadata.Depth_Max ? 'depth' : '';
  let otherFields = [depthSelectPart, fields, secondaryField]
    .filter (f => !!f.length)
    .join (', ');

  let depthOrderPart = metadata.Depth_Max ? ', depth' : '';

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

const constructQuery = (v) => {
  const { parameters, metadata, queryType } = v.meta;
  const { queryString, params } = queryType === 'query'
              ? sparseDataQueryFromPayload (parameters, metadata)
              : queryType === 'sp'
              ? storedProcedureUri (parameters)
              : {};
  return { queryString, params };
}

// fetch sproc query: helper that calls a sproc endpoint
// with a flag that will cause the sql server to respond with
// an ansi compliant query that can be run on prem or on cluster
// :: [error?, queryString, message?];
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
const storedProcedure = async (req, res, next) => {
  console.log ('calling stored procedure controller');
  let log = moduleLogger.setReqId(req.requestId);
  let argSet = req.query;

  log.info("stored procedure call", { ...argSet })

  let spExecutionQuery;

  if (argSet.spName === 'uspVariableMetadata') {
    spExecutionQuery = `EXEC ${argSet.spName} '[${argSet.tableName}]', '${argSet.shortName}', 1`;
  } else {

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
  }
};

// route handler
const sampleVis = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId)

  const { varId, shortname } = req.query;
  const { requestId } = req;

  // get dataset info
  const [e, data] = await getDatasetVisualizableVariables (shortname, requestId);
  if (e) {
    log.error ('get dataset vis vars failed', { error: e });
    res.status (e.status).send (e.message);
    return next(e);
  }

  // decide what kind of query to run
  const { variables } = data;
  const selectedVariable = variables.find ((v) => ('' + v.ID === varId));

  if (!selectedVariable) {
    log.error ('could not find variable in dataset variables', { variables, varId })
    res.status (400).send ('could not find variable in dataset variables');
    return next(e);
  }

  const { queryType } = selectedVariable.meta;

  const { queryString, params } = constructQuery (selectedVariable);

  res.set ('X-CMAP-VisType', 'myVisType');

  // delegate
  if (queryType === 'query') {
    queryHandler (req, res, next, queryString);
  } else if (queryType === 'sp') {
    req.query = params;
    storedProcedure (req, res, next);
  } else {
    log.error ('could not resolve query type', { variables, varId })
    res.status (400).send ('could not resolve query type');
    return next(true);
  }
}

module.exports = sampleVis;
