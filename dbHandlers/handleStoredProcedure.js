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

    // ndjsonStream.once('data', () => {
    //     res.writeHead(200, {
    //         'Transfer-Encoding': 'chunked',
    //         'charset' : 'utf-8',
    //         'Content-Type': 'application/json',
    //         'Content-Encoding': 'gzip'        
    //     })
    // })

    ndjsonStream.on('error', err => {
        next(err);
    })

    request.pipe(ndjsonStream)
        .pipe(transformer)
        .pipe(gzip)
        .pipe(res);

    // request.on('error', err => res.end(JSON.stringify(err)));
    // pool.on('error', err => res.end(JSON.stringify(err)));
    
    // request.input('tableName', sql.NVarChar, argSet.tableName);
    // request.input('fields', sql.NVarChar, argSet.fields);
    // request.input('dt1', sql.NVarChar, argSet.dt1);
    // request.input('dt2', sql.NVarChar, argSet.dt2);
    // request.input('lat1', sql.NVarChar, argSet.lat1);
    // request.input('lat2', sql.NVarChar, argSet.lat2);
    // request.input('lon1', sql.NVarChar, argSet.lon1);
    // request.input('lon2', sql.NVarChar, argSet.lon2);
    // request.input('depth1', sql.NVarChar, argSet.depth1);
    // request.input('depth2', sql.NVarChar, argSet.depth2);

    // EXEC uspWeekly 'tblAltimetry_REP', 'adt', '2016-04-30', '2016-07-30', '30', '32', '-160', '-158', '0', '10'

    // .pipe does not close on error so we need to close all the streams conditionally when the response ends

    // request.execute(argSet.spName);

    let spExecutionQuery = `EXEC ${argSet.spName} '${argSet.tableName}', '${argSet.fields}', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}'`;
    console.log(spExecutionQuery);
    request.query(spExecutionQuery);
};