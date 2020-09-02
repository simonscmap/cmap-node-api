const sql = require('mssql');

const nodeCache = require('../utility/nodeCache');
const queryHandler = require('../utility/queryHandler');
var pools = require('../dbHandlers/dbPools');

const datasetCatalogQuery = `
SELECT
ds.Dataset_Name as Short_Name,
ds.Dataset_Long_Name as Long_Name,
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
aggs.Sensors,
refs.[References]

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
    Dataset_ID
    FROM udfCatalog()
    GROUP BY Dataset_ID
) as aggs
ON aggs.Dataset_ID = cat.Dataset_ID

JOIN (
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
    let { keywords, hasDepth, timeStart, timeEnd } = req.query;
    if(typeof keywords === 'string') keywords = [keywords];

    let query = datasetCatalogQuery;

    if(keywords && keywords.length){
        keywords.forEach((keyword, i) => {
            query += `\nAND aggs.Keywords like '%${keyword}%'`;
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
    
    let result = await request.query(query);

    let catalogResponse = result.recordset;
    catalogResponse.forEach((e, i) => {
        e.Sensors = [... new Set(e.Sensors.split(','))];        
    });

    res.writeHead(200, {'Cache-Control': 'max-age=1800'})
    await res.end(JSON.stringify(catalogResponse));
    next();
}

// Takes a dataset short name and returns json of dataset and member variables
exports.datasetFullPage = async(req, res, next) => {
    let { datasetID } = req.query;
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let query = datasetFullPageInfoQuery +
        `WHERE cat.Dataset_ID=${datasetID}     
        AND cat.ID in (
            SELECT
            MAX(ID) from udfCatalog()
            WHERE cat.Dataset_ID=${datasetID}
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
        Variable_MAX,
        Comment,
        Sensor
        FROM udfCatalog() WHERE Dataset_ID=${datasetID}
        `
    let result = await request.query(query);

    res.writeHead(200, {'Cache-Control': 'max-age=1800'});

    let datasetData = result.recordsets[0][0];
    datasetData.Sensors = [... new Set(datasetData.Sensors.split(','))];  
    datasetData.Variables = result.recordsets[1];
    datasetData.References = datasetData.References.split('$$$');
    await res.end(JSON.stringify(datasetData));
    next();
}