const sql = require('mssql');

const nodeCache = require('../utility/nodeCache');
const queryHandler = require('../utility/queryHandler');
var pools = require('../dbHandlers/dbPools');
const datasetCatalogQuery = require('../dbHandlers/datasetCatalogQuery');
const datasetFullPageQuery = require('../dbHandlers/datasetFullPageQuery');
const cruiseCatalogQuery = require('../dbHandlers/cruiseCatalogQuery');
const catalogPlusLatCountQuery = require('../dbHandlers/catalogPlusLatCountQuery');

const variableCatalog = `
    SELECT 
    RTRIM(LTRIM(Short_Name)) AS Variable,
    [tblVariables].Table_Name AS [Table_Name],
    RTRIM(LTRIM(Long_Name)) AS [Long_Name],
    RTRIM(LTRIM(Unit)) AS [Unit],
    RTRIM(LTRIM(Make)) AS [Make],
    RTRIM(LTRIM(Sensor)) AS [Sensor],
    RTRIM(LTRIM(Process_Stage_Long)) AS [Process_Level],
    RTRIM(LTRIM(Study_Domain)) AS [Study_Domain],
    RTRIM(LTRIM(Temporal_Resolution)) AS [Temporal_Resolution],
    RTRIM(LTRIM(Spatial_Resolution)) AS [Spatial_Resolution],
    JSON_VALUE(JSON_stats,'$.time.min') AS [Time_Min],
    JSON_VALUE(JSON_stats,'$.time.max') AS [Time_Max],
    CAST(JSON_VALUE(JSON_stats,'$.lat.count') AS float) AS [Row_Count],
    CAST(JSON_VALUE(JSON_stats,'$.lat.min') AS float) AS [Lat_Min],
    CAST(JSON_VALUE(JSON_stats,'$.lat.max') AS float) AS [Lat_Max],
    CAST(JSON_VALUE(JSON_stats,'$.lon.min') AS float) AS [Lon_Min],
    CAST(JSON_VALUE(JSON_stats,'$.lon.max') AS float) AS [Lon_Max],
    CAST(JSON_VALUE(JSON_stats,'$.depth.min') AS float) AS [Depth_Min],
    CAST(JSON_VALUE(JSON_stats,'$.depth.max') AS float) AS [Depth_Max],
    CAST(JSON_VALUE(JSON_stats,'$."'+[Short_Name]+'"."25%"') AS float) AS [Variable_25th],
    CAST(JSON_VALUE(JSON_stats,'$."'+[Short_Name]+'"."50%"') AS float) AS [Variable_50th],
    CAST(JSON_VALUE(JSON_stats,'$."'+[Short_Name]+'"."75%"') AS float) AS [Variable_75th],
    CAST(JSON_VALUE(JSON_stats,'$."'+[Short_Name]+'".count') AS float) AS [Variable_Count],
    CAST(JSON_VALUE(JSON_stats,'$."'+[Short_Name]+'".mean') AS float) AS [Variable_Mean],
    CAST(JSON_VALUE(JSON_stats,'$."'+[Short_Name]+'".std') AS float) AS [Variable_Std],
    CAST(JSON_VALUE(JSON_stats,'$."'+[Short_Name]+'".min') AS float) AS [Variable_Min],
    CAST(JSON_VALUE(JSON_stats,'$."'+[Short_Name]+'".max') AS float) AS [Variable_Max],
    RTRIM(LTRIM(Comment)) AS [Comment],
    RTRIM(LTRIM([tblDatasets].Dataset_Name)) as [Dataset_Short_Name],
    RTRIM(LTRIM(Dataset_Long_Name)) AS [Dataset_Name],
    RTRIM(LTRIM([Data_Source])) AS [Data_Source],
    RTRIM(LTRIM(Distributor)) AS [Distributor],
    RTRIM(LTRIM([Description])) AS [Dataset_Description],
    RTRIM(LTRIM([Acknowledgement])) AS [Acknowledgement],
    [tblVariables].Dataset_ID AS [Dataset_ID],
    [tblVariables].ID AS [ID],
    [tblVariables].Visualize AS [Visualize],
    [keywords_agg].Keywords AS [Keywords]
    FROM tblVariables
    JOIN tblDataset_Stats ON [tblVariables].Dataset_ID = [tblDataset_Stats].Dataset_ID
    JOIN tblDatasets ON [tblVariables].Dataset_ID=[tblDatasets].ID
    JOIN tblTemporal_Resolutions ON [tblVariables].Temporal_Res_ID=[tblTemporal_Resolutions].ID
    JOIN tblSpatial_Resolutions ON [tblVariables].Spatial_Res_ID=[tblSpatial_Resolutions].ID
    JOIN tblMakes ON [tblVariables].Make_ID=[tblMakes].ID
    JOIN tblSensors ON [tblVariables].Sensor_ID=[tblSensors].ID
    JOIN tblProcess_Stages ON [tblVariables].Process_ID=[tblProcess_Stages].ID
    JOIN tblStudy_Domains ON [tblVariables].Study_Domain_ID=[tblStudy_Domains].ID
    JOIN (SELECT var_ID, STRING_AGG ( CAST(keywords as NVARCHAR(MAX)), ', ') AS Keywords FROM tblVariables var_table
    JOIN tblKeywords key_table ON [var_table].ID = [key_table].var_ID GROUP BY var_ID)
    AS keywords_agg ON [keywords_agg].var_ID = [tblVariables].ID
`;

// No longer used by web app
exports.retrieve = async (req, res, next) => {
    queryHandler(req, res, next, 'EXEC uspCatalog', true);
}

// No longer used by web app
exports.datasets = async (req,res,next) => {
    queryHandler(req, res, next, 'SELECT * FROM tblDatasets', true);
}

exports.description = async (req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    res.cmapSkipCatchAll = true;

    let query =  'SELECT Description FROM [Opedia].[dbo].[tblDatasets] WHERE ID = 1';
    let result = await request.query(query);
    res.json(result.recordset[0]);
}

// Used internally for identifying name mismatches
exports.auditCatalogVariableNames = async(req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let query = 'SELECT Variable, Table_Name from udfCatalog()';

    let result = await request.query(query);
    let tables = {};

    result.recordset.forEach((record, index) => {
        if(!tables[record.Table_Name]){
            tables[record.Table_Name] = new Set();
        }
        tables[record.Table_Name].add(record.Variable);
    });

    let columns = await request.query('SELECT * FROM INFORMATION_SCHEMA.COLUMNS');

    columns.recordset.forEach((column, index) => {
        if(tables[column.TABLE_NAME]){
            tables[column.TABLE_NAME].delete(column.COLUMN_NAME);
        }
    });

    let response = {};

    for(let table in tables){
        if(tables[table].size > 0){
            response[table] = Array.from(tables[table]);
        }
    }

    res.json(response);
}

// Retrieves lists of available options for search and data submission components
exports.submissionOptions = async(req, res, next) => {
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

        result.recordsets.forEach(recordset => {
            recordset.forEach(record => {
                let key = Object.keys(record)[0];

                if(!response[key]){
                    response[key] = [];
                }

                response[key].push(record[key]);
            })
        })
    
        res.json(response); 
        next();
    }

    catch {
        return res.sendStatus(500);
    }

}

// No longer in use in web app
exports.keywords = async(req, res, next) => {
    let keywords = nodeCache.get("keywords");

    if (keywords == undefined ){
        let pool = await pools.dataReadOnlyPool;
        let request = await new sql.Request(pool);

        let query = `SELECT [keywords] from [dbo].[tblKeywords] UNION SELECT [keywords] from [dbo].[tblCruise_Keywords]`;
        let result = await request.query(query);

        keywords = result.recordset.map(e => e.keywords);

        nodeCache.set('keywords', keywords, 3600);
    }

    res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
    await res.end(JSON.stringify(keywords));
    next();
}

// Web app /catalog search endpoint
exports.searchCatalog = async(req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);
    
    let { keywords, hasDepth, timeStart, timeEnd, latStart, latEnd, lonStart, lonEnd, sensor, region, make } = req.query;

    const crosses180 = parseFloat(lonStart) > parseFloat(lonEnd);

    if(typeof keywords === 'string') keywords = [keywords];
    if(typeof region === 'string') region = [region];
    if(typeof make === 'string') make = [make];
    if(typeof sensor === 'string') sensor = [sensor];

    let query = datasetCatalogQuery;

    if(keywords && keywords.length){
        keywords.forEach((keyword, i) => {
            if(keyword.length){
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
        })
    }

    if(hasDepth === 'yes'){
        query += `\nAND aggs.Depth_Max is not null`;
    }

    if(hasDepth === 'no'){
        query += `\nAND aggs.Depth_Max is null`;
    }

    if(timeStart){
        query += `\nAND (aggs.Time_Max > '${timeStart}' OR aggs.Time_Max IS NULL)`;
    }

    if(timeEnd){
        query += `\nAND (aggs.Time_Min < '${timeEnd}' OR aggs.Time_Min IS NULL)`;
    }

    if(latStart){
        query += `\nAND (aggs.Lat_Max > '${latStart}' OR aggs.Lat_Min IS NULL)`;
    }

    if(latEnd){
        query += `\nAND (aggs.Lat_Min < '${latEnd}' OR aggs.Lat_Max IS NULL)`;
    }

    if(sensor && sensor.length){
        query += `\nAND (
            ${sensor.map(r => `aggs.Sensors LIKE '%${r}%'`).join('\nOR ')}
        )`;
    }

    if(region && region.length){
        query += `\nAND (
            ${region.map(r => `regs.Regions LIKE '%${r}%'`).join('\nOR ')}
            \n OR regs.Regions LIKE 'Global'
        )`;
    }

    if(make && make.length){
        query += `\nAND cat.Make IN ('${make.join("','")}')`
    }

    if(crosses180){
        query += `\nAND (
            (aggs.Lon_Max BETWEEN ${lonStart} AND 180) OR 
            (aggs.Lon_Max BETWEEN -180 AND ${lonEnd}) OR
            (aggs.Lon_Min BETWEEN ${lonStart} AND 180) OR
            (aggs.Lon_Min Between -180 and ${lonEnd}) OR 
            aggs.Lon_Max IS NULL OR
            aggs.Lon_Min IS Null
            )`;
    }

    else {
        if(lonStart){
            query += `\nAND (aggs.Lon_Max > '${lonStart}' OR aggs.Lon_Min IS NULL)`;
        }
    
        if(lonEnd){
            query += `\nAND (aggs.Lon_Min < '${lonEnd}' OR aggs.Lon_Max IS NULL)`;
        }
    }


    query += '\nORDER BY Long_Name';
    
    let result = await request.query(query);

    let catalogSearchResponse = result.recordset;
    catalogSearchResponse.forEach((e, i) => {
        e.Sensors = [... new Set(e.Sensors.split(','))];        
    });
    
    res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
    await res.end(JSON.stringify(catalogSearchResponse));
    next();
}

// Retrieves dataset and variable information for catalog pages
exports.datasetFullPage = async(req, res, next) => {
    let { shortname } = req.query;
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let query = datasetFullPageQuery +
        `AND ds.Dataset_Name='${shortname}'   

        SELECT
        Variable,
        Long_Name,
        Unit,
        Lat_Min,
        Lat_Max,
        Lon_Min,
        Lon_Max,
        Depth_Min,
        Depth_Max,
        Time_Min,
        Time_Max,
        Spatial_Resolution,
        Temporal_Resolution,  
        Study_Domain,     
        Variable_25th,
        Variable_50th,
        Variable_75th,
        Variable_Count,
        Variable_Mean,
        Variable_STD,
        Variable_Min,
        Variable_Max,
        Make,
        Visualize,
        Comment,
        Sensor,
        Keywords
        FROM (${variableCatalog}) cat
        WHERE Dataset_Short_Name='${shortname}'
        ORDER BY Long_Name

        SELECT * FROM tblCruise
        WHERE ID IN
        (
            SELECT Cruise_ID
            FROM tblDataset_Cruises
            WHERE Dataset_ID IN (
                SELECT ID
                FROM tblDatasets
                WHERE Dataset_Name = '${shortname}'
            )
        )
    `;

    let result = await request.query(query);
    
    res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});

    let datasetData = result.recordsets[0][0];
    datasetData.Sensors = [... new Set(datasetData.Sensors.split(','))];  
    datasetData.Variables = result.recordsets[1];
    datasetData.Cruises = result.recordsets[2];
    datasetData.References = datasetData.References ? datasetData.References.split('$$$') : [];
    await res.end(JSON.stringify(datasetData));
    next();
}

// Retrieves datasets associated with a cruise
exports.datasetsFromCruise = async(req, res, next) => {
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

    query += '\nORDER BY Long_Name';
    let result = await request.query(query);

    let catalogResponse = result.recordset;
    catalogResponse.forEach((e, i) => {
        e.Sensors = [... new Set(e.Sensors.split(','))];        
    });

    res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
    await res.end(JSON.stringify(catalogResponse));
    next();
}

// Retrieves cruises associated with a dataset
exports.cruisesFromDataset = async(req, res, next) => {
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

    let result = await request.query(query);

    let response = result.recordset;
    res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
    await res.end(JSON.stringify(response));
    next();
}

// Retrieves information for rendering a cruise page (as linked in cruise exploration component or from catalog dataset page)
exports.cruiseFullPage = async(req, res, next) => {
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

    let result = await request.query(query);
    let cruiseData = result.recordsets[0][0];
    cruiseData.datasets = result.recordsets[1]
    res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
    await res.end(JSON.stringify(cruiseData));
    next();
}

// Not currently in use. Cruise search is fully client-side
exports.searchCruises = async(req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);
    
    let { searchTerms, chiefScientist, timeStart, timeEnd, latStart, latEnd, lonStart, lonEnd } = req.query;
    if(typeof searchTerms === 'string') searchTerms = [searchTerms];
    
    if(sensor && !(sensor === "Any" || sensor === "GPS")) {
        res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
        await res.end(JSON.stringify([]));
        return next();
    }

    const crosses180 = parseFloat(lonStart) > parseFloat(lonEnd);

    if(typeof searchTerms === 'string') searchTerms = [searchTerms];

    let query = cruiseCatalogQuery;
    let clauses = [];

    if(searchTerms && searchTerms.length){
        searchTerms.forEach((keyword, i) => {
            clauses.push(`(
                aggs.Keywords LIKE '%${keyword}%' 
                OR Name LIKE '%${keyword}%' 
                OR Ship_Name LIKE '%${keyword}%'
                OR Chief_Name LIKE '%${keyword}%'
            )`);
        })
    }

    if(timeStart){
        clauses.push(`(End_Time > '${timeStart}' OR End_Time IS NULL)`);
    }

    if(timeEnd){
        clauses.push(`(Start_Time < '${timeEnd}' OR Start_Time IS NULL)`);
    }

    if(latStart){
        clauses.push(`(Lat_Max > '${latStart}' OR Lat_Min IS NULL)`);
    }

    if(latEnd){
        clauses.push(`(Lat_Min < '${latEnd}' OR Lat_Max IS NULL)`);
    }

    if(crosses180){
        clauses.push(`(
            (Lon_Max BETWEEN ${lonStart} AND 180) OR 
            (Lon_Max BETWEEN -180 AND ${lonEnd}) OR
            (Lon_Min BETWEEN ${lonStart} AND 180) OR
            (Lon_Min Between -180 and ${lonEnd}) OR 
            Lon_Max IS NULL OR
            Lon_Min IS Null
            )`);
    }

    else {
        if(lonStart){
            clauses.push(`(Lon_Max > '${lonStart}' OR Lon_Min IS NULL)`);
        }
    
        if(lonEnd){
            clauses.push(`(Lon_Min < '${lonEnd}' OR Lon_Max IS NULL)`);
        }
    }

    if(clauses.length){
        query += `\nWHERE`;
        query += clauses.join('\nAND ');
    }

    query += '\nORDER BY Name';

    let result = await request.query(query);

    let catalogResponse = result.recordset;
    console.log(catalogResponse)
    res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
    await res.end(JSON.stringify(catalogResponse));
    next();
}

// Retrieves all member variables of a dataset
exports.memberVariables = async(req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);
    const { datasetID } = req.query;

    try {
        let query = `SELECT * FROM udfCatalog() WHERE Dataset_ID = ${datasetID}`;
        let response = await request.query(query);
        res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
        await res.end(JSON.stringify(response.recordset));
        next();
    }

    catch(e) {
        console.log(e);
        res.sendStatus(500);
    }
}

// Variable search used by viz plots page
exports.variableSearch = async(req, res, next) => {
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
        region
    } = req.query;

    sensor = typeof sensor === 'string' ? [sensor] : sensor;
    make = typeof make ==='string' ? [make] : make;
    region = typeof region === 'string' ? [region] : region;

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
    
    let visualizeClause = 'WHERE Visualize = 1';
    let placeholder = 'WHERE 1 = 1';

    let clauses = [];
        
    if(make){
        clauses.push(`\nAND Make IN ('${make.join("','")}')`);
    }

    if(temporalResolution && temporalResolution !== 'Any'){
        clauses.push(`\nAND Temporal_Resolution = '${temporalResolution}'`);
    }

    if(spatialResolution && spatialResolution !== 'Any'){
        clauses.push(`\nAND Spatial_Resolution = '${spatialResolution}'`);
    }

    if(dataSource && dataSource !== 'Any'){
        clauses.push(`\nAND Data_Source = '${dataSource}'`);
    }

    if(distributor && distributor !== 'Any'){
        clauses.push(`\nAND Distributor = '${distributor}'`);
    }

    if(processLevel && processLevel !=='Any'){
        clauses.push(`\nAND Process_Level = '${processLevel}'`);
    }

    if(searchTerms && searchTerms.length){
        searchTerms = searchTerms.split(' ');
        searchTerms.forEach((keyword, i) => {
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
        })
    }

    if(hasDepth === 'yes'){
        clauses.push(`\nAND Depth_Max is not null`);
    }

    if(hasDepth === 'no'){
        clauses.push(`\nAND Depth_Max is null`);
    }

    if(timeStart){
        clauses.push(`\nAND (Time_Max > '${timeStart}' OR Time_Max IS NULL)`);
    }

    if(timeEnd){
        clauses.push(`\nAND (Time_Min < '${timeEnd}' OR Time_Min IS NULL)`);
    }

    if(sensor){
        clauses.push(`\nAND Sensor IN ('${sensor.join("','")}')`);
    }

    if(region && region.length){
        clauses.push(`\nAND (
            ${region.map(r => `Regions LIKE '%${r}%'`).join('\nOR ')}
            \n OR Regions LIKE 'Global'
        )`);
    }

    if(latStart){
        clauses.push(`\nAND (Lat_Max > ${latStart} OR Lat_Min IS NULL)`);
    }

    if(latEnd){
        clauses.push(`\nAND (Lat_Min < ${latEnd} OR Lat_Max IS NULL)`);
    }

    if(crosses180){
        clauses.push(`\nAND (
            (Lon_Max BETWEEN ${lonStart} AND 180) OR 
            (Lon_Max BETWEEN -180 AND ${lonEnd}) OR
            (Lon_Min BETWEEN ${lonStart} AND 180) OR
            (Lon_Min Between -180 and ${lonEnd}) OR 
            Lon_Max IS NULL OR
            Lon_Min IS Null
            )`);
    }

    else {
        if(lonStart){
            clauses.push(`\nAND (Lon_Max > ${lonStart} OR Lon_Min IS NULL)`);
        }
    
        if(lonEnd){
            clauses.push(`\nAND (Lon_Min < ${lonEnd} OR Lon_Max IS NULL)`);
        }
    }

    let searchOrderClause = '\nORDER BY Long_Name';
    let countGroupByClause = 'GROUP BY Make';

    let joinedClauses = clauses.join('');

    let searchQuery = [searchBaseQuery, visualizeClause, joinedClauses, searchOrderClause].join('');
    let countQuery = [countBaseQuery, placeholder, joinedClauses, countGroupByClause].join('');
    let combinedQuery = [searchQuery, countQuery].join('');
    
    try {
        let response = await request.query(combinedQuery);
        let counts = response.recordsets[1].reduce((acc, e) => {
            acc[e.Make] = e.Count; 
            return acc;
        }, {});
        res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'max-age=7200'});
        await res.end(JSON.stringify({
            counts,
            variables: response.recordsets[0]
        }));
        next();
    }

    catch(e) {
        console.log(e);
        res.sendStatus(500);
    }
}

// No longer in use by web app
exports.autocompleteVariableNames = async(req, res, next) => {
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
        let names = response.recordset.map(record => record.Long_Name);
        res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
        await res.end(JSON.stringify(names));
        next();
    }

    catch(e) {
        console.log(e);
        res.sendStatus(500);
    }
}

// Retrieve a single variable
exports.variable = async(req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    try {
        let { id } = req.query;

        let query = `${catalogPlusLatCountQuery} WHERE tblVariables.ID = ${id}`;
        let response = await request.query(query);

        res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
        await res.end(JSON.stringify(response.recordset[0]));
        next();
    }

    catch(e) {
        console.log(e);
        res.sendStatus(500);
    }
}

// Retrieve partial information for a dataset
exports.datasetSummary = async(req, res, next) => {
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
        res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
        await res.end(JSON.stringify(response.recordset[0]));
        next();
    }

    catch(e) {
        console.log(e);
        res.sendStatus(500);
    }
}