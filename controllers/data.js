const queryHandler = require("../utility/queryHandler");
const initializeLogger = require("../log-service");
const pools = require("../dbHandlers/dbPools");
const sql = require("mssql");
const { fetchDataRetrievalProcedureNamesWithCache } = require('../utility/router/queries');
const { isSproc, extractSprocName } = require('../utility/router/pure');

const moduleLogger = initializeLogger("controllers/data");

// fetch sproc query: helper that calls a sproc endpoint
// with a flag that will cause the sql server to respond with
// an ansi compliant query that can be run on prem or on cluster
// :: [error?, queryString, message?];
const fetchSprocQuery = async (reqId, spExecutionQuery, argSet) => {
  let log = moduleLogger.setReqId (reqId);
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);
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
    log.error('error fetching sproc statement: no result', { query: spExecutionQuery });
    return [true, null, 'error fetching sproc statement'];
  }
};

// ~~~~ CONTROLLERS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Custom query endpoint
const customQuery = async (req, res, next) => {
  req.cmapApiCallDetails.query = req.query.query;
  let log = moduleLogger.setReqId(req.requestId);

  log.info ("custom query", { argType: (typeof req.query.query), query: req.query.query });

  if (isSproc (req.query.query)) {
    let uspDataRetrievingNames = await fetchDataRetrievalProcedureNamesWithCache();


    if (uspDataRetrievingNames === null) {
      res.status (500).send ('error analyzing query');
      return;
    }
    let sprocName = extractSprocName (req.query.query).toLocaleLowerCase();

    console.log (uspDataRetrievingNames, sprocName);

    if (uspDataRetrievingNames.map(name => name.toLowerCase()).includes(sprocName)) {
      let [error, queryToRun] = await fetchSprocQuery (req.requestId, req.query.query, req.query);
      if (error) {
        return res.status (500).send ('error preparing query');
      } else {
        log.trace ('passing query to queryHandler', { queryToRun });
        return queryHandler(req, res, next, queryToRun);
      }
    } else {
      // if sproc is not a data-retrieving sproc, let it run as is
      log.trace ('sproc is not a data-retrieving sproc');
    }
  }

  queryHandler(req, res, next, req.query.query);
};

// Stored procedure call endpoint
// NOTE: this only serves the subset of stored procedures that power the chart visualizations
const storedProcedure = async (req, res, next) => {
  let log = moduleLogger.setReqId(req.requestId);
  let argSet = req.query;

  log.trace("stored procedure call", { name: argSet.spName })

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

    let [error, q, message] = await fetchSprocQuery(req.requestId, spExecutionQuery, req.query);
    if (error) {
      return next(message);
    } else {
      return queryHandler(req, res, next, q);
    }
  }
};

// Retrieves a single cruise trajectory
const cruiseTrajectory = async (req, res, next) => {
  let cruiseID = req.query.id;
  let query = `EXEC uspCruiseTrajectory ${cruiseID}`;
  req.cmapApiCallDetails.query = query;
  queryHandler(req, res, next, query);
};

// provide list of tables with ancillary data
// uses sproc
const ancillaryDatasets = async (req, res, next) => {
  let query = "EXEC uspDatasetsWithAncillary";
  req.cmapApiCallDetails.query = query;
  queryHandler(req, res, next, query);
};

// Retrieves all cruises
const cruiseList = async (req, res, next) => {
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  let query = `
    SELECT
    [tblCruise].ID
    ,[tblCruise].Nickname
    ,[tblCruise].Name
    ,[tblCruise].Ship_Name
    ,[tblCruise].Start_Time
    ,[tblCruise].End_Time
    ,[tblCruise].Lat_Min
    ,[tblCruise].Lat_Max
    ,[tblCruise].Lon_Min
    ,[tblCruise].Lon_Max
    ,[tblCruise].Chief_Name
    ,[keywords_agg].Keywords
    ,CAST(YEAR(Start_Time) as NVARCHAR) as Year
    ,cruise_regions.Regions
    ,CASE
        WHEN tblCruise_Series.Series IS NOT NULL THEN tblCruise_Series.Series
        WHEN tblCruise_Series.Series IS NULL THEN 'Other'
        END AS Series
    FROM tblCruise
    LEFT JOIN tblCruise_Series ON tblCruise.Cruise_Series = tblCruise_Series.ID
    LEFT JOIN (
        SELECT cr.Cruise_ID AS ID,
        STRING_AGG(CAST(Region_Name as NVARCHAR(MAX)), ',') as Regions
        FROM tblCruise_Regions cr
        LEFT JOIN tblRegions rg ON cr.Region_ID = rg.Region_ID
        GROUP BY cr.Cruise_ID
    ) cruise_regions ON tblCruise.ID = cruise_regions.ID
    LEFT JOIN (SELECT cruise_ID, STRING_AGG (CAST(key_table.keywords AS VARCHAR(MAX)), ', ') AS Keywords FROM tblCruise tblC
    JOIN tblCruise_Keywords key_table ON [tblC].ID = [key_table].cruise_ID GROUP BY cruise_ID) AS keywords_agg ON [keywords_agg].cruise_ID = [tblCruise].ID
    WHERE [tblCruise].ID IN (SELECT DISTINCT Cruise_ID FROM tblDataset_Cruises)
    `;

  let result = await request.query(query);
  res.writeHead(200, {
    "Cache-Control": "max-age=7200",
    "Content-Type": "application/json",
  });
  await res.end(JSON.stringify(result.recordset));
  next();
};

// Retrieves table stats for a variable
const tableStats = async (req, res, next) => {
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  let query = `select tblDV.Table_Name, tblS.JSON_stats from tblDataset_Stats tblS inner join
    (select tblD.ID, tblV.Table_Name FROM tblVariables tblV
    inner join tblDatasets tblD on tblV.Dataset_ID = tblD.ID) tblDV
    on tblS.Dataset_ID= tblDV.ID
    where tblDV.Table_Name = '${req.query.table}'`;

  let result = await request.query(query);

  if (result.recordset.length < 1) {
    res.json({ error: "Table not found" });
    return;
  }
  res.send(result.recordset[0].JSON_stats);
};

module.exports = {
  customQuery,
  storedProcedure,
  cruiseTrajectory,
  ancillaryDatasets,
  cruiseList,
  tableStats,
};
