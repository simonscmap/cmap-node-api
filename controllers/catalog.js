const sql = require('mssql');

const nodeCache = require('../utility/nodeCache');
const queryHandler = require('../utility/queryHandler');
var pools = require('../dbHandlers/dbPools');

const tempCatalogQuery = `
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
    RTRIM(LTRIM([tblDatasets].Dataset_Name)) as Dataset_Short_Name,
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
    JOIN (SELECT var_ID, STRING_AGG (keywords, ', ') AS Keywords FROM tblVariables var_table
    JOIN tblKeywords key_table ON [var_table].ID = [key_table].var_ID GROUP BY var_ID)
    AS keywords_agg ON [keywords_agg].var_ID = [tblVariables].ID
`;

const datasetCatalogQuery = `
SELECT
ds.Dataset_Name as Short_Name,
TRIM(ds.Dataset_Long_Name) as Long_Name,
ds.Icon_URL,
ds.Description,
cat.Table_Name,
cat.Process_Level,
cat.Make,
cat.Data_Source,
cat.Distributor,
cat.Acknowledgement,
cat.Dataset_ID,
cat.Spatial_Resolution,
cat.Temporal_Resolution,
aggs.Lat_Min,
aggs.Lat_Max,
aggs.Lon_Min,
aggs.Lon_Max,
aggs.Depth_Min,
aggs.Depth_Max,
aggs.Time_Min,
aggs.Time_Max,
aggs.Sensors
FROM udfCatalog() as cat

JOIN tblDatasets as ds
on ds.ID = cat.Dataset_ID

JOIN (
    SELECT
    MIN(Lat_Min) as Lat_Min,
    MAX(Lat_Max) as Lat_Max,
    MIN(Lon_Min) as Lon_Min,
    MAX(Lon_Max) as Lon_Max,
    Min(Depth_Min) as Depth_Min,
    MAX(Depth_Max) as Depth_Max,
    MIN(Time_Min) as Time_Min,
    Max(Time_Max) as Time_Max,
    STRING_AGG(CAST(Keywords AS nvarchar(MAX)), ',') as Keywords,
    STRING_AGG(CAST(Sensor AS nvarchar(MAX)), ',') as Sensors,
    STRING_AGG(CAST(Long_Name AS nvarchar(MAX)), ',') as Variable_Long_Names,
    Dataset_ID
    FROM udfCatalog()
    GROUP BY Dataset_ID
) as aggs
ON aggs.Dataset_ID = cat.Dataset_ID

WHERE cat.ID in (
    SELECT
    MAX(ID) from udfCatalog()
    GROUP BY Dataset_ID
)
`;

const datasetFullPageInfoQuery = `
SELECT
ds.Dataset_Name as Short_Name,
ds.Dataset_Long_Name as Long_Name,
ds.Description,
ds.Icon_URL,
cat.Table_Name,
cat.Process_Level,
cat.Make,
cat.Data_Source,
cat.Distributor,
cat.Acknowledgement,
cat.Dataset_ID,
cat.Spatial_Resolution,
cat.Temporal_Resolution,
cat.Row_Count,
aggs.Lat_Min,
aggs.Lat_Max,
aggs.Lon_Min,
aggs.Lon_Max,
aggs.Depth_Min,
aggs.Depth_Max,
aggs.Time_Min,
aggs.Time_Max,
aggs.Sensors,
aggs.Keywords,
refs.[References]

FROM (${tempCatalogQuery}) cat

JOIN tblDatasets as ds
on ds.ID = cat.Dataset_ID

JOIN (
    SELECT
    MIN(Lat_Min) as Lat_Min,
    MAX(Lat_Max) as Lat_Max,
    MIN(Lon_Min) as Lon_Min,
    MAX(Lon_Max) as Lon_Max,
    Min(Depth_Min) as Depth_Min,
    MAX(Depth_Max) as Depth_Max,
    MIN(Time_Min) as Time_Min,
    Max(Time_Max) as Time_Max,
    STRING_AGG(CAST(Keywords AS nvarchar(MAX)), ',') as Keywords,
    STRING_AGG(CAST(Sensor AS nvarchar(MAX)), ',') as Sensors,    
    Dataset_ID
    FROM udfCatalog()
    GROUP BY Dataset_ID
) as aggs
ON aggs.Dataset_ID = cat.Dataset_ID

LEFT OUTER JOIN (
    SELECT
    Dataset_ID,
    STRING_AGG(CAST(Reference AS nvarchar(MAX)), '$$$') as [References]
    FROM tblDataset_References
    GROUP BY Dataset_ID
) as refs
on ds.ID = refs.Dataset_ID
`;

exports.retrieve = async (req, res, next) => {
    queryHandler(req, res, next, 'EXEC uspCatalog', true);
}

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

exports.submissionOptions = async(req, res, next) => {
    let pool = await pools.dataReadOnlyPool;

    let request = await new sql.Request(pool);
    let query = `
        SELECT Make FROM tblMakes
        SELECT Sensor FROM tblSensors
        SELECT Study_Domain FROM tblStudy_Domains
        SELECT Temporal_Resolution FROM tblTemporal_Resolutions
        SELECT Spatial_Resolution FROM tblSpatial_Resolutions
    `

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

exports.keywords = async(req, res, next) => {
    let keywords = nodeCache.get("keywords");

    if (keywords == undefined ){
        let pool = await pools.dataReadOnlyPool;
        let request = await new sql.Request(pool);

        let query = `SELECT DISTINCT [keywords] from [dbo].[tblKeywords]`;
        let result = await request.query(query);

        keywords = result.recordset.map(e => e.keywords);

        nodeCache.set('keywords', keywords, 3600);
    }

    res.writeHead(200, {'Cache-Control': 'max-age=3600'})
    await res.end(JSON.stringify(keywords));
    next();
}

exports.searchCatalog = async(req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);
    
    let { keywords, hasDepth, timeStart, timeEnd, latStart, latEnd, lonStart, lonEnd } = req.query;

    const crosses180 = parseFloat(lonStart) > parseFloat(lonEnd);

    if(typeof keywords === 'string') keywords = [keywords];

    let query = datasetCatalogQuery;

    if(keywords && keywords.length){
        keywords.forEach((keyword, i) => {
            query += `\nAND (
                aggs.Variable_Long_Names LIKE '%${keyword}%' 
                OR aggs.Sensors LIKE '%${keyword}%' 
                OR aggs.Keywords LIKE '%${keyword}%'
                OR cat.Distributor LIKE '%${keyword}%'
                OR cat.Data_Source LIKE '%${keyword}%'
                OR cat.Process_Level LIKE '%${keyword}%'
                OR cat.Study_Domain LIKE '%${keyword}%'
            )`;
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

    let catalogResponse = result.recordset;
    catalogResponse.forEach((e, i) => {
        e.Sensors = [... new Set(e.Sensors.split(','))];        
    });

    res.writeHead(200, {'Cache-Control': 'max-age=1800'})
    await res.end(JSON.stringify(catalogResponse));
    next();
}

// Takes a dataset ID and returns json of dataset and member variables
exports.datasetFullPage = async(req, res, next) => {
    let { shortname } = req.query;
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let query = datasetFullPageInfoQuery +
        `WHERE ds.Dataset_Name='${shortname}'   
        AND cat.ID in (
            SELECT
            MAX(ID) from udfCatalog()
            WHERE ds.Dataset_Name='${shortname}'
            GROUP BY Dataset_ID
        )

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
        Variable_25th,
        Variable_50th,
        Variable_75th,
        Variable_Count,
        Variable_Mean,
        Variable_STD,
        Variable_Min,
        Variable_Max,
        Comment,
        Sensor
        FROM (${tempCatalogQuery}) cat
        WHERE Dataset_Short_Name='${shortname}'
        ORDER BY Long_Name
    `;

    let result = await request.query(query);

    res.writeHead(200, {'Cache-Control': 'max-age=1800'});

    let datasetData = result.recordsets[0][0];
    datasetData.Sensors = [... new Set(datasetData.Sensors.split(','))];  
    datasetData.Variables = result.recordsets[1];
    datasetData.References = datasetData.References ? datasetData.References.split('$$$') : [];

    await res.end(JSON.stringify(datasetData));
    next();
}