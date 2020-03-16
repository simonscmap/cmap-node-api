const sql = require('mssql');
const ndjson = require('ndjson');
const zlib = require('zlib');

var pools = require('./dbPools');
const CustomTransformStream = require('../utility/CustomTransformStream');

// Calls stored named procedure with the supplied parameters, and 
// streams response to client as gzipped ndjson.
module.exports =  async (argSet, res, next) => { 
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    const ndjsonStream = ndjson.serialize();
    const transformer = new CustomTransformStream();
    const gzip = zlib.createGzip({level:1});

    res.writeHead(200, {
        'Transfer-Encoding': 'chunked',
        'charset' : 'utf-8',
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip'        
    })

    ndjsonStream.on('error', err => {
        next(err);
    })

    request.pipe(ndjsonStream)
        .pipe(transformer)
        .pipe(gzip)
        .pipe(res);

    let spExecutionQuery = `EXEC ${argSet.spName} '${argSet.tableName}', '${argSet.fields}', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}'`;

    request.query(spExecutionQuery);
};