// Handle queries for regions that cross the 180th meridian

var pools = require('../dbHandlers/dbPools');
const sql = require('mssql');
const stringify = require('csv-stringify')

const Accumulator = require('../utility/AccumulatorStream');
const generateError = require('../errorHandling/generateError');

function formatDate(date) {
    // if(date.getUTCHours() === 0){
    //     let month  = date.getUTCMonth() + 1;
    //     let day = date.getUTCDate();
    //     let year = date.getUTCFullYear();
    //     return [year, month < 10 ? '0' + month : month, day < 10 ? '0' + day : day].join('-');
    // } else return 
    return date.toISOString();
}

module.exports = async(req, res, next) => {
    let start = new Date();
    let argSet = req.query;
    res.cmapSkipCatchAll = true;

    let pool = await pools.dataReadOnlyPool;
    let request1 = await new sql.Request(pool);

    req.on('close', () => {
        request1.cancel();
    })

    request1.stream = true;    

    let csvStream1 = stringify({
        header:true,
        cast: {
            date: dateObj => formatDate(dateObj)
        }
    })

    csvStream1.on('error', err => {
        if(!res.headersSent) res.status(400).end(err)
        else res.end();
    });

    let accumulator1 = new Accumulator();
    let spExecutionQuery1 = `EXEC ${argSet.spName} '${argSet.tableName}', '${argSet.fields}', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '180', '${argSet.depth1}', '${argSet.depth2}'`;

    let recordLength;

    request1.on('recordset', recordset => {
        if(!res.headersSent){
            res.writeHead(200, {
                'Transfer-Encoding': 'chunked',
                'Content-Type': 'text/plain',
                'Cache-Control': 'max-age=86400'
            })
            recordLength = Object.keys(recordset).length;
            request1
            .pipe(csvStream1)
            .pipe(accumulator1)
            .pipe(res, {end: false});
        }
    })

    request1.on('error', err => {
        if(res.headersSent) res.end();
        else res.status(400).end(generateError(err));
    });

    let query1Resolution = new Promise((resolve, reject) => {
        accumulator1.on('finish', () => resolve());
    })

    request1.query(spExecutionQuery1);

    await query1Resolution;

    // Execute query 2  with lon transformation and manually close stream
    let nextIndicator = new Array(recordLength).fill('next').join(',') + '\n';
    res.write(nextIndicator);
    
    let request2 = await new sql.Request(pool);

    req.on('close', () => {
        request2.cancel();
    })

    request2.stream = true;    

    let csvStream2 = stringify({
        cast: {
            date: dateObj => formatDate(dateObj)
        }
    })

    csvStream2.on('error', err => {
        res.end();
    });

    let accumulator2 = new Accumulator();
    let spExecutionQuery2 = `EXEC ${argSet.spName} '${argSet.tableName}', '${argSet.fields}', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '-180', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}'`;

    request2.pipe(csvStream2).pipe(accumulator2).pipe(res);

    request2.on('error', err => {
        res.end();
    });

    request2.query(spExecutionQuery2);
}