const queryHandler = require('../utility/queryHandler');

var pools = require('../dbHandlers/dbPools');
var protoLib = require('../config/protoInit');
const sql = require('mssql');

const Transform = require('stream').Transform

exports.customQuery = async (req, res, next)=>{
    req.cmapApiCallDetails.query = req.query.query;
    queryHandler(req, res, next, req.query.query);
};

exports.storedProcedure = async (req, res, next)=>{
    let argSet = req.query;
    let spExecutionQuery = `EXEC ${argSet.spName} '${argSet.tableName}', '${argSet.fields}', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}'`;
    console.log(spExecutionQuery);
    req.cmapApiCallDetails.query = spExecutionQuery;

    queryHandler(req, res, next, spExecutionQuery);
};

exports.cruiseTrajectory = async (req, res, next) => {
    let cruiseID = req.query.id;
    let query = `EXEC uspCruiseTrajectory ${cruiseID}`;

    req.cmapApiCallDetails.query = query;

    queryHandler(req, res, next, query);
}

exports.cruiseList = async (req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let query =  'EXEC uspCruises';
    let result = await request.query(query);
    let cruiseList = result.recordset;
    cruiseList.forEach(cruise => delete cruise.Chief_Email);
    res.json(cruiseList);
}

exports.tableStats = async (req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let result = await request.query(`SELECT JSON_stats from tblDataset_Stats where Dataset_Name = '${req.query.table}'`);

    if(result.recordset.length < 1) {
        res.json({error: 'Table not found'});
        return;
    }
    res.send(result.recordset[0].JSON_stats);
}

exports.testProto = async(req, res, next) => {
    let protos = await protoLib;
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);
    // request.stream = true;

    const protoStream = new ProtoTransform(protos.SpaceTimeRow, 'sst');

    let query = "EXEC uspSpaceTime 'tblSST_AVHRR_OI_NRT', 'sst', '1981-09-01', '1981-09-01', '-90', '90', '-180', '180', '0', '0'"

    // request.on('recordset', recordset => {
    //     if(!res.headersSent){
    //         res.writeHead(200, headers);
    //         request.on('row', row => {
    //             if(protoStream.write(row) === false) request.pause();
    //         })
    //     }
    // })

    req.on('close', () => {
        request.cancel();
    })

    protoStream.on('drain', () => request.resume());
    request.on('done', () => protoStream.end());

    protoStream.pipe(res);

    const headers = {
        'Transfer-Encoding': 'chunked',
        'Content-Type': "application/octet-stream"
    }
    let start = new Date();
    let result = await request.query(query);
    res.json(result.recordsets[0]);
    console.log(new Date() - start);
    next();
}

class ProtoTransform extends Transform {
    constructor(messageClass, variableName){
        super({objectMode: true});
        this.messageClass = messageClass;
        this.variableName = variableName;
    }

    _transform(chunk, encoding, done){
        var row = {
            time: chunk.time.toISOString(),
            lat: chunk.lat,
            lon: chunk.lon,
            var: chunk[this.variableName]
        }

        this.push(this.messageClass.encodeDelimited(row).finish());
        done();
    }
}