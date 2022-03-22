const queryHandler = require('../utility/queryHandler');

var pools = require('../dbHandlers/dbPools');
const sql = require('mssql');

// Custom query endpoint
exports.customQuery = async (req, res, next)=> {
    req.cmapApiCallDetails.query = req.query.query;
    queryHandler(req, res, next, req.query.query);
};

// Stored procedure call endpoint
// NOTE: this only serves the subset of stored procedures that power the chart visualizations
exports.storedProcedure = async (req, res, next)=>{
    let argSet = req.query;

    let fields = argSet.fields.replace(/[\[\]']/g,'' );
    let tableName = argSet.tableName.replace(/[\[\]']/g,'' );

    let spExecutionQuery = `EXEC ${argSet.spName} '[${tableName}]', '[${fields}]', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}'`;
    req.cmapApiCallDetails.query = spExecutionQuery;
    queryHandler(req, res, next, spExecutionQuery);
};

// Retrieves a single cruise trajectory
exports.cruiseTrajectory = async (req, res, next) => {
    let cruiseID = req.query.id;
    let query = `EXEC uspCruiseTrajectory ${cruiseID}`;
    req.cmapApiCallDetails.query = query;
    queryHandler(req, res, next, query);
}

// provide list of tables with ancillary data
// uses sproc
exports.ancillaryDatasets = async (req, res, next) => {
  let query = 'EXEC uspDatasetsWithAncillary';
  req.cmapApiCallDetails.query = query;
  queryHandler(req, res, next, query);
}

// Retrieves all cruises
exports.cruiseList = async (req, res, next) => {
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
    res.writeHead(200, {'Cache-Control': 'max-age=7200', 'Content-Type': 'application/json'});
    await res.end(JSON.stringify(result.recordset));
    next();
}

// Retrieves table stats for a variable
exports.tableStats = async (req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let query =
    `select tblDV.Table_Name, tblS.JSON_stats from tblDataset_Stats tblS inner join
    (select tblD.ID, tblV.Table_Name FROM tblVariables tblV
    inner join tblDatasets tblD on tblV.Dataset_ID = tblD.ID) tblDV
    on tblS.Dataset_ID= tblDV.ID
    where tblDV.Table_Name = '${req.query.table}'`

    let result = await request.query(query);

    if(result.recordset.length < 1) {
        res.json({error: 'Table not found'});
        return;
    }
    res.send(result.recordset[0].JSON_stats);
}

// Protocol buffer test from long ago. Kept for reference
// exports.testProto = async(req, res, next) => {
//     let protos = await protoLib;
//     let pool = await pools.dataReadOnlyPool;
//     let request = await new sql.Request(pool);
//     // request.stream = true;

//     const protoStream = new ProtoTransform(protos.SpaceTimeRow, 'sst');

//     let query = "EXEC uspSpaceTime 'tblSST_AVHRR_OI_NRT', 'sst', '1981-09-01', '1981-09-01', '-90', '90', '-180', '180', '0', '0'"

//     // request.on('recordset', recordset => {
//     //     if(!res.headersSent){
//     //         res.writeHead(200, headers);
//     //         request.on('row', row => {
//     //             if(protoStream.write(row) === false) request.pause();
//     //         })
//     //     }
//     // })

//     req.on('close', () => {
//         request.cancel();
//     })

//     protoStream.on('drain', () => request.resume());
//     request.on('done', () => protoStream.end());

//     protoStream.pipe(res);

//     const headers = {
//         'Transfer-Encoding': 'chunked',
//         'Content-Type': "application/octet-stream"
//     }
//     let start = new Date();
//     let result = await request.query(query);
//     res.json(result.recordsets[0]);
//     next();
// }

// class ProtoTransform extends Transform {
//     constructor(messageClass, variableName){
//         super({objectMode: true});
//         this.messageClass = messageClass;
//         this.variableName = variableName;
//     }

//     _transform(chunk, encoding, done){
//         var row = {
//             time: chunk.time.toISOString(),
//             lat: chunk.lat,
//             lon: chunk.lon,
//             var: chunk[this.variableName]
//         }

//         this.push(this.messageClass.encodeDelimited(row).finish());
//         done();
//     }
// }
