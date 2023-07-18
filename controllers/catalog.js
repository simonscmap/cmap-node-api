const sql = require("mssql");

const nodeCache = require("../utility/nodeCache");
const queryHandler = require("../utility/queryHandler");
const { coerceToISO } = require("../utility/download/coerce-to-iso");
const pools = require("../dbHandlers/dbPools");
const datasetCatalogQuery = require("../dbHandlers/datasetCatalogQuery");
const cruiseCatalogQuery = require("../dbHandlers/cruiseCatalogQuery");
const { makeDatasetFullPageQuery, makeDatasetVariablesQuery } =
  require("../queries/datasetFullPageQuery")
const { makeVariableUMQuery } = require("../queries/variableUM");
const { getDatasetId } = require("../queries/datasetId");
const catalogPlusLatCountQuery = require("../dbHandlers/catalogPlusLatCountQuery");
const logInit = require("../log-service");

// const log = logInit("controllers/catalog");
const moduleLogger = logInit("controllers/catalog");

// No longer used by web app
module.exports.retrieve = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId)

  log.error("deprecated", {
    route: req.originalUrl,
    controller: "catalog.retrieve",
  });
  queryHandler(req, res, next, "EXEC uspCatalog", true);
};

// No longer used by web app
module.exports.datasets = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId)

  log.error("deprecated", {
    route: req.originalUrl,
    controller: "catalog.retrieve",
  });
  queryHandler(req, res, next, "SELECT * FROM tblDatasets", true);
};

module.exports.description = async (req, res) => {

  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  let query =
    "SELECT Description FROM [Opedia].[dbo].[tblDatasets] WHERE ID = 1";
  let result = await request.query(query);
  res.json(result.recordset[0]);
};

// Used internally for identifying name mismatches
module.exports.auditCatalogVariableNames = async (req, res) => {
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  let query = "SELECT Variable, Table_Name from udfCatalog()";

  let result = await request.query(query);
  let tables = {};

  result.recordset.forEach((record) => {
    if (!tables[record.Table_Name]) {
      tables[record.Table_Name] = new Set();
    }
    tables[record.Table_Name].add(record.Variable);
  });

  let columns = await request.query("SELECT * FROM INFORMATION_SCHEMA.COLUMNS");

  columns.recordset.forEach((column) => {
    if (tables[column.TABLE_NAME]) {
      tables[column.TABLE_NAME].delete(column.COLUMN_NAME);
    }
  });

  let response = {};

  for (let table in tables) {
    if (tables[table].size > 0) {
      response[table] = Array.from(tables[table]);
    }
  }

  res.json(response);
};

// Retrieves lists of available options for search and data submission components
module.exports.submissionOptions = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId)
  let pool = await pools.dataReadOnlyPool;

  let request = await new sql.Request(pool);
  let query = `
        SELECT Make FROM tblMakes ORDER BY Make
        SELECT Sensor FROM tblSensors ORDER BY Sensor
        SELECT Study_Domain FROM tblStudy_Domains ORDER BY Study_Domain
        SELECT Temporal_Resolution FROM tblTemporal_Resolutions ORDER BY Temporal_Resolution
        SELECT Spatial_Resolution FROM tblSpatial_Resolutions ORDER BY Spatial_Resolution
        SELECT DISTINCT Data_Source FROM udfCatalog() ORDER BY Data_Source
        SELECT DISTINCT Distributor FROM udfCatalog() ORDER BY Distributor
        SELECT Process_Stage_Long as Process_Level FROM tblProcess_Stages
    `;

  try {
    let result = await request.query(query);

    let response = {};

    result.recordsets.forEach((recordset) => {
      recordset.forEach((record) => {
        let key = Object.keys(record)[0];

        if (!response[key]) {
          response[key] = [];
        }

        response[key].push(record[key]);
      });
    });

    res.json(response);
    next();
  } catch {
    log.error('error retrieving submission options', { result });
    return res.sendStatus(500);
  }
};

// No longer in use in web app
module.exports.keywords = async (req, res, next) => {
  let keywords = nodeCache.get("keywords");

  if (keywords == undefined) {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let query = `SELECT [keywords] from [dbo].[tblKeywords] UNION SELECT [keywords] from [dbo].[tblCruise_Keywords]`;
    let result = await request.query(query);

    keywords = result.recordset.map((e) => e.keywords);

    nodeCache.set("keywords", keywords, 3600);
  }

  res.writeHead(200, {
    "Cache-Control": "max-age=7200",
    "Content-Type": "application/json",
  });
  await res.end(JSON.stringify(keywords));
  next();
};

// Web app /catalog search endpoint
module.exports.searchCatalog = async (req, res, next) => {
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  let {
    keywords,
    hasDepth,
    timeStart,
    timeEnd,
    latStart,
    latEnd,
    lonStart,
    lonEnd,
    sensor,
    region,
    make,
  } = req.query;

  const crosses180 = parseFloat(lonStart) > parseFloat(lonEnd);

  if (typeof keywords === "string") keywords = [keywords];
  if (typeof region === "string") region = [region];
  if (typeof make === "string") make = [make];
  if (typeof sensor === "string") sensor = [sensor];

  let query = datasetCatalogQuery;

  if (keywords && keywords.length) {
    keywords.forEach((keyword) => {
      if (keyword.length) {
        query += `\nAND (
                    aggs.Variable_Long_Names LIKE '%${keyword}%'
                    OR aggs.Variable_Short_Names LIKE '%${keyword}%'
                    OR ds.Dataset_Long_Name LIKE '%${keyword}%'
                    OR aggs.Sensors LIKE '%${keyword}%'
                    OR aggs.Keywords LIKE '%${keyword}%'
                    OR cat.Distributor LIKE '%${keyword}%'
                    OR cat.Data_Source LIKE '%${keyword}%'
                    OR cat.Process_Level LIKE '%${keyword}%'
                    OR cat.Study_Domain LIKE '%${keyword}%'
                )`;
      }
    });
  }

  if (hasDepth === "yes") {
    query += `\nAND aggs.Depth_Max is not null`;
  }

  if (hasDepth === "no") {
    query += `\nAND aggs.Depth_Max is null`;
  }

  if (timeStart) {
    query += `\nAND (aggs.Time_Max > '${timeStart}' OR aggs.Time_Max IS NULL)`;
  }

  if (timeEnd) {
    query += `\nAND (aggs.Time_Min < '${timeEnd}' OR aggs.Time_Min IS NULL)`;
  }

  if (latStart) {
    query += `\nAND (aggs.Lat_Max > '${latStart}' OR aggs.Lat_Min IS NULL)`;
  }

  if (latEnd) {
    query += `\nAND (aggs.Lat_Min < '${latEnd}' OR aggs.Lat_Max IS NULL)`;
  }

  if (sensor && sensor.length) {
    query += `\nAND (
            ${sensor.map((r) => `aggs.Sensors LIKE '%${r}%'`).join("\nOR ")}
        )`;
  }

  if (region && region.length) {
    query += `\nAND (
            ${region.map((r) => `regs.Regions LIKE '%${r}%'`).join("\nOR ")}
            \n OR regs.Regions LIKE 'Global'
        )`;
  }

  if (make && make.length) {
    query += `\nAND cat.Make IN ('${make.join("','")}')`;
  }

  if (crosses180) {
    query += `\nAND (
            (aggs.Lon_Max BETWEEN ${lonStart} AND 180) OR
            (aggs.Lon_Max BETWEEN -180 AND ${lonEnd}) OR
            (aggs.Lon_Min BETWEEN ${lonStart} AND 180) OR
            (aggs.Lon_Min Between -180 and ${lonEnd}) OR
            aggs.Lon_Max IS NULL OR
            aggs.Lon_Min IS Null
            )`;
  } else {
    if (lonStart) {
      query += `\nAND (aggs.Lon_Max > '${lonStart}' OR aggs.Lon_Min IS NULL)`;
    }

    if (lonEnd) {
      query += `\nAND (aggs.Lon_Min < '${lonEnd}' OR aggs.Lon_Max IS NULL)`;
    }
  }

  query += "\nORDER BY Dataset_Release_Date DESC";

  let result = await request.query(query);

  let catalogSearchResponse = result.recordset;
  catalogSearchResponse.forEach((e) => {
    e.Sensors = [...new Set(e.Sensors.split(","))];
  });

  res.writeHead(200, {
    "Cache-Control": "max-age=7200",
    "Content-Type": "application/json",
  });
  await res.end(JSON.stringify(catalogSearchResponse));
  next();
};

// Retrieves dataset and variable information for catalog pages
module.exports.datasetFullPage = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId).addContext(['query', req.query]);
  let { shortname } = req.query;
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  // getDatasetId depends on a cached list of dataset ids
  // this cache can be temporarily stale if a dateset's id has been updated
  // the ttl is 60minutes
  let datasetId = await getDatasetId (shortname);

  if (!datasetId) {
    log.error('could not find dataset id for dataset name', { shortname })
    res.status(400).send('error finding dataset id');
    return next();
  }

  // get dataset and cruise info
  let query1 = makeDatasetFullPageQuery (datasetId);

  let result1;
  try {
    result1 = await request.query(query1);
  } catch (e) {
    log.error('error making full page query', { err: e })
    res.status(500).send('error making query');
    return next();
  }

  // the query contains 2 select statements,
  // each is returned in the order queried as a recodset

  // dataset can be empty if the dataset id is incorrect (taken from stale cache)
  let dataset = result1.recordsets[0] && result1.recordsets[0][0];
  let cruises = result1.recordsets[1];
  // let variables = result2.recordsets[0];

  if (!dataset) {
    log.error('no matching dataset is dataset full page query', { datasetId, shortname });
    res.status(400).send('no matching dataset');
    return next();
  }

  let { References, Sensors, ...topLevelDatasetProps } = dataset;

  let sensors = [...new Set(Sensors.split(","))];
  let references = References
                 ? References.split("$$$")
                 : [];

  let payload = {
    dataset: topLevelDatasetProps,
    sensors: sensors,
    cruises: cruises,
    references: references,
  };

  await res.json(payload);
  return next();
};

module.exports.datasetVariables = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId)
  let { shortname } = req.query;
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  let datasetId = await getDatasetId (shortname);
  if (!datasetId) {
    log.error('could not find dataset id for dataset name', { shortname })
    res.status(400).send('error finding dataset id');
    return;
  }

  let query = `EXEC uspVariableCatalog ${datasetId}`;
  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error('error making variable catalog query', { err: e })
    res.status(500).send('error making query');
    return;
  }

  res.json(result.recordset);
  next();
}

module.exports.datasetVariableUM = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId);
  let { shortname } = req.query;
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);
  let query = makeVariableUMQuery (shortname);
  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error('error making variable UM query', { err: e })
    res.status(500).send('error making query');
    return;
  }

  let data = result.recordsets[0];
  if (Array.isArray(data)) {
    // turn this into a key/value object
    let map = {}
    data.forEach((entry) => {
      if (entry.Variable) {
        try {
          map[entry.Variable] = JSON.parse(entry.Unstructured_Variable_Metadata);
        } catch (e) {
          log.warn ('error parsing metadata while marshalling response', {
            variable: entry.Variable,
            shortname,
          });
        }
      }
    });
    await res.json(map);
    next();
    return;
  } else {
    log.error ('expected recordset to be an array', { recordsets: result.recordsets });
    res.status(500).send('error marshaling query result');
    return;
  }
};

// merge "fullpage" "variables" and "variableum" into one response
// to serve the data for creating a download
module.exports.datasetMetadata = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId).addContext(['query', req.query]);
  let { shortname } = req.query;
  let pool = await pools.dataReadOnlyPool;

  let datasetId = await getDatasetId (shortname, log);
  if (!datasetId) {
    log.error('could not find dataset id for dataset name', { shortname })
    res.status(400).send('error finding dataset id');
    return next('error finding dataset id');
  }

  // get dataset and cruise info
  let datasetQuery = makeDatasetFullPageQuery (datasetId);

  let datasetResult;
  try {
    let request = await new sql.Request(pool);
    datasetResult = await request.query(datasetQuery);
  } catch (e) {
    log.error('error making full page query', { error: e });
    res.status(500).send('error making query');
    return next('error querying dataset');
  }

  // the query contains 2 select statements,
  // each is returned in the order queried as a recordset
  let dataset = datasetResult.recordsets[0][0];
  let cruises = datasetResult.recordsets[1];

  if (!dataset) {
    log.error('sql returned no dataset', { shortname, datasetId });
    res.status(500).send('error retrieving dataset');
    return next('error querying dataset');
  }

  let { References, Sensors, ...topLevelDatasetProps } = dataset;



  // correct for sometimes incorrect date format
  topLevelDatasetProps.Time_Min = coerceToISO(topLevelDatasetProps.Time_Min, log);
  topLevelDatasetProps.Time_Max = coerceToISO(topLevelDatasetProps.Time_Max, log);

  let sensors;
  if (!Sensors || typeof Sensors !== 'string') {
    sensors = [];
  } else {
    sensors = [...new Set(Sensors.split(","))];
  }

  let references = (References && typeof References === 'string')
                 ? References.split("$$$")
                 : [];

  let variablesQuery = `EXEC uspVariableCatalog ${datasetId}`;
  let variablesResult;
  try {
    let request = await new sql.Request(pool);
    variablesResult = await request.query(variablesQuery);
  } catch (e) {
    log.error('error making variable catalog query', { error: e })
    res.status(500).send('error making query');
    return next('error querying variables');
  }

  let vumQuery = makeVariableUMQuery (shortname);
  let vumResult;
  try {
    let request = await new sql.Request(pool);
    vumResult = await request.query(vumQuery);
  } catch (e) {
    log.error('error making variable UM query', { error: e })
    res.status(500).send('error making query');
    return next('error querying variable metadata');
  }

  let vumMap = {}
  if (Array.isArray(vumResult.recordsets[0])) {
    // turn this into a key/value object
    vumResult.recordsets[0].forEach((entry) => {
      if (entry.Variable) {
        vumMap[entry.Variable] = entry.Unstructured_Variable_Metadata;
      }
    });
  } else {
    log.error ('expected recordset to be an array', { recordsets: vumResult.recordsets });
    res.status(500).send('error marshaling query result');
    return next('error marshaling variable metadata');
  }

  // join dataset stats and unstructured metadata with variables
  let datasetStats = {
    Time_Min: coerceToISO(dataset.Time_Min, log),
    Time_Max: coerceToISO(dataset.Time_Max, log),
    Lat_Min: dataset.Lat_Min,
    Lat_Max: dataset.Lat_Max,
    Lon_Min: dataset.Lon_Min,
    Lon_Max: dataset.Lon_Max,
    Depth_Min: dataset.Depth_Min,
    Depth_Max: dataset.Depth_Max,
  };

  let ammendedVariables = {};
  if (variablesResult && Array.isArray(variablesResult.recordset)) {
    ammendedVariables = variablesResult.recordset.map((variable) => {
      return Object.assign({}, variable, datasetStats, {
        Unstructured_Variable_Metadata: vumMap[variable.Variable] || null
      });
    });
  }

  let payload = {
    dataset: topLevelDatasetProps,
    sensors: sensors,
    cruises: cruises,
    references: references,
    variables: ammendedVariables,
  };

  res.json(payload);
  next();
};


// Retrieves datasets associated with a cruise
module.exports.datasetsFromCruise = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId)
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);
  const { cruiseID } = req.query;

  let query = datasetCatalogQuery;
  query += `
        AND Dataset_ID IN (
            SELECT Dataset_ID
            FROM tblDataset_Cruises
            WHERE Cruise_ID = ${cruiseID}
        )
    `;

  query += "\nORDER BY Long_Name";

  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error ('error retrieving datasets from cruise', { error: e });
    res.status(500).send('error retrieving datasets');
    return next();
  }

  let catalogResponse = result.recordset;
  catalogResponse.forEach((e) => {
    e.Sensors = [...new Set(e.Sensors.split(","))];
  });

  res.writeHead(200, {
    "Cache-Control": "max-age=7200",
    "Content-Type": "application/json",
  });
  await res.end(JSON.stringify(catalogResponse));
  next();
};

// Retrieves cruises associated with a dataset
module.exports.cruisesFromDataset = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId);
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);
  const { datasetID } = req.query;

  let query = `
        SELECT *
        FROM tblCruise
        WHERE Cruise_ID IN (
            SELECT *
            FROM tblDataset_Cruises
            WHERE Dataset_ID = ${datasetID}
        )
    `;

  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error ('error retrieving cruises from dataset', { error: e });
    res.status(500).send('error retrieving cruises');
    return next();
  }

  let response = result.recordset;
  res.writeHead(200, {
    "Cache-Control": "max-age=7200",
    "Content-Type": "application/json",
  });
  await res.end(JSON.stringify(response));
  next();
};

// Retrieves information for rendering a cruise page (as linked in cruise exploration component or from catalog dataset page)
module.exports.cruiseFullPage = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId);
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  const { name } = req.query;

  let query = `
        SELECT * FROM tblCruise
        WHERE Name='${name}'

        SELECT
        Dataset_Name,
        Dataset_Long_Name
        FROM tblDatasets
        WHERE ID IN (
            SELECT Dataset_ID
            FROM tblDataset_Cruises
            WHERE Cruise_ID IN (
                SELECT ID
                FROM tblCruise
                WHERE Name='${name}'
            )
        )
    `;

  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error('error making cruise full page query', { err: e })
    res.status(500).send('error making query');
    return next();
  }

  let cruiseData = result.recordsets[0] && result.recordsets[0][0];

  if (!cruiseData) {
    log.error('no matching cruise', { name })
    res.status(400).send('no matching cuise');
    return next();
  }

  cruiseData.datasets = result.recordsets[1];
  res.writeHead(200, {
    "Cache-Control": "max-age=7200",
    "Content-Type": "application/json",
  });
  await res.end(JSON.stringify(cruiseData));
  next();
};

// Not currently in use. Cruise search is fully client-side
module.exports.searchCruises = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId);
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  let {
    searchTerms,
    timeStart,
    timeEnd,
    latStart,
    latEnd,
    lonStart,
    lonEnd,
    sensor,
  } = req.query;
  if (typeof searchTerms === "string") searchTerms = [searchTerms];

  if (sensor && !(sensor === "Any" || sensor === "GPS")) {
    res.writeHead(200, {
      "Cache-Control": "max-age=7200",
      "Content-Type": "application/json",
    });
    await res.end(JSON.stringify([]));
    return next();
  }

  const crosses180 = parseFloat(lonStart) > parseFloat(lonEnd);

  if (typeof searchTerms === "string") searchTerms = [searchTerms];

  let query = cruiseCatalogQuery;
  let clauses = [];

  if (searchTerms && searchTerms.length) {
    searchTerms.forEach((keyword) => {
      clauses.push(`(
                aggs.Keywords LIKE '%${keyword}%'
                OR Name LIKE '%${keyword}%'
                OR Ship_Name LIKE '%${keyword}%'
                OR Chief_Name LIKE '%${keyword}%'
            )`);
    });
  }

  if (timeStart) {
    clauses.push(`(End_Time > '${timeStart}' OR End_Time IS NULL)`);
  }

  if (timeEnd) {
    clauses.push(`(Start_Time < '${timeEnd}' OR Start_Time IS NULL)`);
  }

  if (latStart) {
    clauses.push(`(Lat_Max > '${latStart}' OR Lat_Min IS NULL)`);
  }

  if (latEnd) {
    clauses.push(`(Lat_Min < '${latEnd}' OR Lat_Max IS NULL)`);
  }

  if (crosses180) {
    clauses.push(`(
            (Lon_Max BETWEEN ${lonStart} AND 180) OR
            (Lon_Max BETWEEN -180 AND ${lonEnd}) OR
            (Lon_Min BETWEEN ${lonStart} AND 180) OR
            (Lon_Min Between -180 and ${lonEnd}) OR
            Lon_Max IS NULL OR
            Lon_Min IS Null
            )`);
  } else {
    if (lonStart) {
      clauses.push(`(Lon_Max > '${lonStart}' OR Lon_Min IS NULL)`);
    }

    if (lonEnd) {
      clauses.push(`(Lon_Min < '${lonEnd}' OR Lon_Max IS NULL)`);
    }
  }

  if (clauses.length) {
    query += `\nWHERE`;
    query += clauses.join("\nAND ");
  }

  query += "\nORDER BY Name";

  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error ('error executing cruise search', { error: e });
    res.status(500).send('error executing search');
    return next();
  }

  let catalogResponse = result.recordset;
  res.writeHead(200, {
    "Cache-Control": "max-age=7200",
    "Content-Type": "application/json",
  });

  await res.end(JSON.stringify(catalogResponse));
  next();
};

// Retrieves all member variables of a dataset
module.exports.memberVariables = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId);
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);
  const { datasetID } = req.query;

  try {
    let query = `SELECT * FROM udfCatalog() WHERE Dataset_ID = ${datasetID}`;
    let response = await request.query(query);
    res.writeHead(200, {
      "Cache-Control": "max-age=7200",
      "Content-Type": "application/json",
    });
    await res.end(JSON.stringify(response.recordset));
    next();
  } catch (e) {
    log.error ('error retrieving member variables', { datasetID, error: e });
    res.sendStatus(500);
    next ();
  }
};

// Variable search used by viz plots page
module.exports.variableSearch = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId).addContext(['query', req.query]);
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  let {
    searchTerms,
    hasDepth,
    timeStart,
    timeEnd,
    latStart,
    latEnd,
    lonStart,
    lonEnd,
    sensor,
    dataSource,
    distributor,
    processLevel,
    temporalResolution,
    spatialResolution,
    make,
    region,
  } = req.query;

  sensor = typeof sensor === "string" ? [sensor] : sensor;
  make = typeof make === "string" ? [make] : make;
  region = typeof region === "string" ? [region] : region;

  const crosses180 = parseFloat(lonStart) > parseFloat(lonEnd);

  let searchBaseQuery = `
        SELECT
            ID,
            Long_Name,
            Make,
            Sensor,
            Process_Level,
            Temporal_Resolution,
            Spatial_Resolution,
            Dataset_Name,
            Dataset_Short_Name,
            Data_Source,
            Distributor,
            cat.Dataset_ID,
            Regions
        FROM udfCatalog() cat
        LEFT OUTER JOIN
            (
                SELECT
                ds_reg.Dataset_ID,
                STRING_AGG(CAST(reg.Region_Name AS nvarchar(MAX)), ',') as Regions
                FROM tblDataset_Regions ds_reg
                JOIN tblRegions reg
                ON ds_reg.Region_ID = reg.Region_ID
                GROUP BY ds_reg.Dataset_ID
            ) regs
        on regs.Dataset_ID = cat.Dataset_ID
        `;

  let countBaseQuery = `
        SELECT Make, COUNT(DISTINCT cat.Dataset_ID) AS Count
        FROM udfCatalog() cat
        LEFT OUTER JOIN
            (
                SELECT
                ds_reg.Dataset_ID,
                STRING_AGG(CAST(reg.Region_Name AS nvarchar(MAX)), ',') as Regions
                FROM tblDataset_Regions ds_reg
                JOIN tblRegions reg
                ON ds_reg.Region_ID = reg.Region_ID
                GROUP BY ds_reg.Dataset_ID
            ) regs
        on regs.Dataset_ID = cat.Dataset_ID
    `;

  let visualizeClause = "WHERE Visualize = 1";
  let placeholder = "WHERE 1 = 1";

  let clauses = [];

  if (make) {
    clauses.push(`\nAND Make IN ('${make.join("','")}')`);
  }

  if (temporalResolution && temporalResolution !== "Any") {
    clauses.push(`\nAND Temporal_Resolution = '${temporalResolution}'`);
  }

  if (spatialResolution && spatialResolution !== "Any") {
    clauses.push(`\nAND Spatial_Resolution = '${spatialResolution}'`);
  }

  if (dataSource && dataSource !== "Any") {
    clauses.push(`\nAND Data_Source = '${dataSource}'`);
  }

  if (distributor && distributor !== "Any") {
    clauses.push(`\nAND Distributor = '${distributor}'`);
  }

  if (processLevel && processLevel !== "Any") {
    clauses.push(`\nAND Process_Level = '${processLevel}'`);
  }

  if (searchTerms && searchTerms.length) {
    searchTerms = searchTerms.split(" ");
    searchTerms.forEach((keyword) => {
      clauses.push(`\nAND (
                Long_Name LIKE '%${keyword}%'
                OR Variable LIKE '%${keyword}%'
                OR Sensor LIKE '%${keyword}%'
                OR Keywords LIKE '%${keyword}%'
                OR Distributor LIKE '%${keyword}%'
                OR Data_Source LIKE '%${keyword}%'
                OR Process_Level LIKE '%${keyword}%'
                OR Study_Domain LIKE '%${keyword}%'
                OR Dataset_Name LIKE '%${keyword}%'
            )`);
    });
  }

  if (hasDepth === "yes") {
    clauses.push(`\nAND Depth_Max is not null`);
  }

  if (hasDepth === "no") {
    clauses.push(`\nAND Depth_Max is null`);
  }

  if (timeStart) {
    clauses.push(`\nAND (Time_Max > '${timeStart}' OR Time_Max IS NULL)`);
  }

  if (timeEnd) {
    clauses.push(`\nAND (Time_Min < '${timeEnd}' OR Time_Min IS NULL)`);
  }

  if (sensor) {
    clauses.push(`\nAND Sensor IN ('${sensor.join("','")}')`);
  }

  if (region && region.length) {
    clauses.push(`\nAND (
            ${region.map((r) => `Regions LIKE '%${r}%'`).join("\nOR ")}
            \n OR Regions LIKE 'Global'
        )`);
  }

  if (latStart) {
    clauses.push(`\nAND (Lat_Max > ${latStart} OR Lat_Min IS NULL)`);
  }

  if (latEnd) {
    clauses.push(`\nAND (Lat_Min < ${latEnd} OR Lat_Max IS NULL)`);
  }

  if (crosses180) {
    clauses.push(`\nAND (
            (Lon_Max BETWEEN ${lonStart} AND 180) OR
            (Lon_Max BETWEEN -180 AND ${lonEnd}) OR
            (Lon_Min BETWEEN ${lonStart} AND 180) OR
            (Lon_Min Between -180 and ${lonEnd}) OR
            Lon_Max IS NULL OR
            Lon_Min IS Null
            )`);
  } else {
    if (lonStart) {
      clauses.push(`\nAND (Lon_Max > ${lonStart} OR Lon_Min IS NULL)`);
    }

    if (lonEnd) {
      clauses.push(`\nAND (Lon_Min < ${lonEnd} OR Lon_Max IS NULL)`);
    }
  }

  let searchOrderClause = "\nORDER BY Long_Name";
  let countGroupByClause = "GROUP BY Make";

  let joinedClauses = clauses.join("");

  let searchQuery = [
    searchBaseQuery,
    visualizeClause,
    joinedClauses,
    searchOrderClause,
  ].join("");
  let countQuery = [
    countBaseQuery,
    placeholder,
    joinedClauses,
    countGroupByClause,
  ].join("");
  let combinedQuery = [searchQuery, countQuery].join("");

  try {
    let response = await request.query(combinedQuery);
    let counts = response.recordsets[1].reduce((acc, e) => {
      acc[e.Make] = e.Count;
      return acc;
    }, {});
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "max-age=7200",
    });
    await res.end(
      JSON.stringify({
        counts,
        variables: response.recordsets[0],
      })
    );
    next();
  } catch (e) {
    log.error ('error executing variable search', { error: e, });
    res.sendStatus(500);
  }
};

// No longer in use by web app
module.exports.autocompleteVariableNames = async (req, res, next) => {
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  try {
    let { searchTerms } = req.query;
    // let parsedSearch = searchTerms.split(' ');

    let query = `SELECT DISTINCT Long_Name from udfCatalog() WHERE Visualize = 1`;

    // if(parsedSearch && parsedSearch.length){
    // parsedSearch.forEach((keyword) => {
    query += ` AND (
                Keywords LIKE '%${searchTerms}%'
                OR Data_Source LIKE '%${searchTerms}%'
                OR Process_Level LIKE '%${searchTerms}%'
                OR Sensor LIKE '%${searchTerms}%'
                OR Make like '%${searchTerms}%'
                OR Study_Domain like '%${searchTerms}%'
                OR Long_Name like '%${searchTerms}%'
                OR Variable like '%${searchTerms}%'
            )`;
    // });
    // }

    let response = await request.query(query);
    let names = response.recordset.map((record) => record.Long_Name);
    res.writeHead(200, {
      "Cache-Control": "max-age=7200",
      "Content-Type": "application/json",
    });
    await res.end(JSON.stringify(names));
    next();
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
};

// Retrieve a single variable
module.exports.variable = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId);
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  try {
    let { id } = req.query;

    let query = `${catalogPlusLatCountQuery} WHERE tblVariables.ID = ${id}`;
    let response = await request.query(query);

    res.writeHead(200, {
      "Cache-Control": "max-age=7200",
      "Content-Type": "application/json",
    });
    await res.end(JSON.stringify(response.recordset[0]));
    next();
  } catch (e) {
    log.error ('error retrieving variable', { error: e });
    res.sendStatus(500);
  }
};

// Retrieve partial information for a dataset
module.exports.datasetSummary = async (req, res, next) => {
  let log = moduleLogger.setReqId (req.requestId);
  let pool = await pools.dataReadOnlyPool;
  let request = await new sql.Request(pool);

  try {
    let { id } = req.query;

    let query = `
            SELECT
                Dataset_Name,
                Dataset_Long_Name,
                Description
            FROM tblDatasets WHERE ID = ${id}
        `;

    let response = await request.query(query);
    res.writeHead(200, {
      "Cache-Control": "max-age=7200",
      "Content-Type": "application/json",
    });
    await res.end(JSON.stringify(response.recordset[0]));
    next();
  } catch (e) {
    log.error ('error retrieving dataset summary', { error: e, datasetID: id });
    res.sendStatus(500);
    next();
  }
};
