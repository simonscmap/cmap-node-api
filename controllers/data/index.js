const queryHandler = require("../../utility/queryHandler");
const initializeLogger = require("../../log-service");
const pools = require("../../dbHandlers/dbPools");
const sql = require("mssql");
const { fetchDataRetrievalProcedureNamesWithCache } = require('../../utility/router/queries');
const { isSproc, extractSprocName, queryToAST } = require('../../utility/router/pure');
const directQuery = require('../../utility/directQuery');
const cacheAsync = require('../../utility/cacheAsync');
const { expandIfSelectStar } = require ('../../utility/download/expandSelect');
const { transformFeatureResults } = require('./transforms');
const { bulkDownloadController } = require('./bulk-download');
const namedDataController = require('./namedDataController');
const vaultController = require('./vaultController');

const moduleLogger = initializeLogger("controllers/data");

const toSetArray = (data) => {
  if (!data || !Array.isArray(data)) {
    moduleLogger.error ('toSetArray received incorrect arg; expecting arrray ', data);
    return [];
  }
  let p = new Set();
  data.forEach (p.add, p);
  return Array.from (p);
};

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
    log.error('error fetching sproc statement: no result', { query: spExecutionQuery, result });
    return [true, null, 'error fetching sproc statement'];
  }
};

// ~~~~ CONTROLLERS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/* Custom query controller, invokes data router */
/* no longer in use, in favor of queryModifier middleware (below) */
const customQuery = async (req, res, next) => {
  req.cmapApiCallDetails.query = req.query.query;
  let log = moduleLogger.setReqId(req.requestId);

  log.info ("custom query", { ...req.query });

  let query = req.query.query;

  if (isSproc (req.query.query)) {
    let uspDataRetrievingNames = await fetchDataRetrievalProcedureNamesWithCache();

    log.trace ('fetched usp data', uspDataRetrievingNames);

    if (uspDataRetrievingNames === null) {
      res.status (500).send ('error analyzing query');
      return;
    }

    let sprocName = extractSprocName (req.query.query).toLocaleLowerCase();

    if (uspDataRetrievingNames.map(name => name.toLowerCase()).includes(sprocName)) {
      let spExecutionQuery = `${req.query.query}, 1`;

      log.info ('fetching query for stored procedure', { sproc: spExecutionQuery });

      let [error, queryToRun] = await fetchSprocQuery (req.requestId, spExecutionQuery, req.query);

      if (error) {
        return res.status (500).send ('error preparing query');
      } else {
        log.trace ('updating query to execute', { queryToRun });
        query = queryToRun;
      }
    } else {
      // if sproc is not a data-retrieving sproc, let it run as is
      log.trace ('sproc is not a data-retrieving sproc');
    }
  }
  // if 'select * ...', replace '*' with columns
  let [errorMsg, updatedQuery, queryWasModified] = await expandIfSelectStar (req.query.query);

  if (errorMsg) {
    log.warn (errorMsg, { query })
  } else {
    if (queryWasModified) {
      log.info ('using expanded query', { updatedQuery });
    }
    query = updatedQuery;
  }

  queryHandler (req, res, next, query);
};

// custom query middleware
// applies query modifications
// - if query is a sproc, calls sproc to get executable sql back that can be used with the data router
// - expand column names if query uses a `select *`
const queryModification = async (req, res, next) => {
  req.cmapApiCallDetails.query = req.query.query;
  let log = moduleLogger.setReqId(req.requestId);

  log.info ("custom query", { ...req.query });

  let query = req.query.query;

  if (isSproc (req.query.query)) {
    req.queryType = 'sproc'; // cache result on req obect

    let uspDataRetrievingNames = await fetchDataRetrievalProcedureNamesWithCache();

    log.trace ('fetched usp data', uspDataRetrievingNames);

    if (uspDataRetrievingNames === null) {
      res.status (500).send ('error analyzing query');
      return;
    }

    let sprocName = extractSprocName (req.query.query).toLocaleLowerCase();
    req.sprocName = sprocName; // cache result on req object

    if (uspDataRetrievingNames.map(name => name.toLowerCase()).includes(sprocName)) {
      let spExecutionQuery = `${req.query.query}, 1`;

      log.info ('fetching query for stored procedure', { sproc: spExecutionQuery });

      let [error, queryToRun] = await fetchSprocQuery (req.requestId, spExecutionQuery, req.query);

      if (error) {
        return res.status (500).send ('error preparing query');
      } else {
        log.trace ('updating query to execute', { queryToRun });
        query = queryToRun;
      }
    } else {
      // if sproc is not a data-retrieving sproc, let it run as is
      log.trace ('sproc is not a data-retrieving sproc');
    }
  } else { // query is not executing a sproc
    // try to determine if it is a select
    const ast = queryToAST (req.query.query);
    if (ast && ast.parserResult && ast.parserResult.ast && ast.parserResult.ast.type) {
      const operationType = ast.parserResult.ast.type;
      if (typeof operationType === 'string') {
        req.queryType = operationType.toUpperCase();
      }
    } else {
      req.queryType = 'nodeApi:queryTypeUnknown';
    }
  }


  // if 'select * ...', replace '*' with columns
  let [errorMsg, updatedQuery, queryWasModified] = await expandIfSelectStar (query);

  if (errorMsg) {
    log.warn (errorMsg, { query })
  } else {
    if (queryWasModified) {
      log.info ('using expanded query', { updatedQuery });
    }
    query = updatedQuery;
  }

  req.modifiedQuery = query;
  next();

};


// Stored procedure call endpoint
// NOTE: this only serves the subset of stored procedures that power the chart visualizations
const storedProcedure = async (req, res, next) => {
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

    let [error, q, message] = await fetchSprocQuery(req.requestId, spExecutionQuery, req.query);
    // NOTE: if there has been an error, it has been logged in fechSprocQuery
    if (error) {
      return next(message);
    } else {
      if (argSet.sqlify) {
        return res.json ({ argSet, query: spExecutionQuery });
      }
      await queryHandler(req, res, next, q);
      return next();
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

const cruiseTrajectories = async (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);
  const ids = req.body.cruise_ids;

  if (!Array.isArray (ids) || ids.length === 0) {
    log.error ('invalid args', { body: req.body });
    res.status(400).send('invalid argument');
    return next ('expectd ids to be a non-empty array');
  }

  const query = `SELECT [Cruise_ID], [time], [lat], [lon]
    FROM
        tblCruise_Trajectory
    WHERE
        [Cruise_ID] IN (${ids.join(',')})
    ORDER BY [Cruise_ID], [time], [lat], [lon]`;

  req.cmapApiCallDetails.query = query;
  const options = { description: 'cruise trajectories' };

  const [error, result] = await directQuery(query, options, log);

  if (error || result.recordsets.length <= 0) {
    log.error ('error fetching cruise trajectories', error);
    res.status(500).send('error fetching cruise trajectories');
    return next(error);
  }

  const trajectoryData = result.recordsets[0];

  res.send (trajectoryData);
  next();
}

// provide list of tables with ancillary data
// uses sproc
// TODO: bypass the router
const ancillaryDatasets = async (req, res, next) => {
  let query = "EXEC uspDatasetsWithAncillary";
  req.cmapApiCallDetails.query = query;
  queryHandler(req, res, next, query);
};

// provide a list of tables that are continuously ingested
const ciDatasets = async (req, res, next) => {
  let query = "EXEC uspDatasetBadges";
  req.cmapApiCallDetails.query = query;
  queryHandler(req, res, next, query);
};

const datasetFeatures = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId);
  let query = "EXEC uspDatasetsWithAncillary EXEC uspDatasetBadges";
  req.cmapApiCallDetails.query = query;

  let options = { description: 'dataset features'};

  let [error, result] = await directQuery(query, options, log);

  if (error) {
    res.status (500).send ('error fetching dataset features');
    return next (error);
  }

  if (result && Array.isArray(result.recordsets) && result.recordsets.length === 2) {
    let featureMap = transformFeatureResults (result.recordsets, log);
    res.json (featureMap);
    next();
  } else {
    log.error('incomplete response while fetching dataset features', { result });
    res.status(500).send ('incomplete response');
    return next (new Error('incomplete response while fetching dataset features'));
  }
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
    ,cruise_dataset_variables.Sensors
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
    LEFT JOIN (
      SELECT tblCruise.ID as cId, STRING_AGG(CAST(Sensor as NVARCHAR(MAX)), ',') as Sensors
      FROM tblCruise
      JOIN tblDataset_Cruises on tblCruise.ID = tblDataset_Cruises.Cruise_ID
      JOIN tblVariables on tblVariables.Dataset_ID = tblDataset_Cruises.Dataset_ID
      JOIN tblSensors on tblVariables.Sensor_ID = tblSensors.ID
      GROUP BY tblCruise.ID
    ) cruise_dataset_variables on tblCruise.ID = cruise_dataset_variables.cId
    LEFT JOIN (SELECT cruise_ID, STRING_AGG (CAST(key_table.keywords AS VARCHAR(MAX)), ', ') AS Keywords FROM tblCruise tblC
    JOIN tblCruise_Keywords key_table ON [tblC].ID = [key_table].cruise_ID GROUP BY cruise_ID) AS keywords_agg ON [keywords_agg].cruise_ID = [tblCruise].ID
    WHERE [tblCruise].ID IN (SELECT DISTINCT Cruise_ID FROM tblDataset_Cruises)
    `;

  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    res.sendStats(500);
    return next(e)
  }

  const cruises = result.recordset.map((c) => {
    return {
      ...c,
      Sensors: toSetArray(c.Sensors.split(',')).sort()
    }
  });

  res.writeHead(200, {
    "Cache-Control": "max-age=7200",
    "Content-Type": "application/json",
  });


  await res.end(JSON.stringify(cruises));
  next();
};

// Retrieves table stats for a variable
const tableStats = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId);

  let query = `select tblDV.Table_Name, tblS.JSON_stats from tblDataset_Stats tblS inner join
    (select tblD.ID, tblV.Table_Name FROM tblVariables tblV
    inner join tblDatasets tblD on tblV.Dataset_ID = tblD.ID) tblDV
    on tblS.Dataset_ID= tblDV.ID
    where tblDV.Table_Name = '${req.query.table}'`;

  req.cmapApiCallDetails.query = query;
  let options = { description: 'table stats'};
  let [error, result] = await directQuery(query, options, log);

  if (error) {
    res.status(500).json({ error: 'error retrieving table stats' });
    return next (error);
  }

  if (result.recordset.length < 1) {
    res.status(404).json({ error: "Table not found" });
    return next (new Error('table not found'));
  }

  res.send(result.recordset[0].JSON_stats);
};


const fetchTrajectoryPointCounts = async (log) => {
  const options = { description: 'table stats' };
  const query = 'select Cruise_ID, count(Cruise_ID) points from tblCruise_Trajectory group by Cruise_ID';
  let [e, result] = await directQuery(query, options, log);
  if (e) {
    moduleLogger.error ('error fetching trajectory counts', { error: e });
    return [true, []];
  }

  const indexedCounts = result.recordset.reduce((acc, curr) => {
    Object.assign(acc, { [curr.Cruise_ID]: curr.points });
    return acc;
  }, {});

  return [null, indexedCounts];
}

const trajectoryPointCounts = async (req, res, next) => {
  const result = await cacheAsync (
    'CACHE_KEY_TRAJECTORY_POINTS',
    fetchTrajectoryPointCounts,
    { ttl: 60 * 60 * 24 }
  );

  if (result.length === 0) {
    res.status(500).json({ error: 'error retrieving table stats' });
    return next('error retrieving table stats');
  }

  res.json (result);
  next();
}

module.exports = {
  ancillaryDatasets,
  bulkDownloadController,
  ciDatasets,
  cruiseList,
  cruiseTrajectories,
  cruiseTrajectory,
  customQuery,
  datasetFeatures,
  namedDataController,
  queryModification,
  storedProcedure,
  tableStats,
  trajectoryPointCounts,
  getShareLinkController: vaultController.getShareLinkController
};
