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

module.exports = async (req, res, next, query) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    // cancel sql request if client closes connection
    req.on('close', () => {
        request.cancel();
    })

    request.stream = true;

    res.cmapSkipCatchAll = true;

    let csvStream = stringify({
        header:true,
        cast: {
            date: dateObj => formatDate(dateObj)
        }
    })

    csvStream.on('error', err => {
        if(!res.headersSent) res.status(400).end(err)
        else res.end();
    });

    request.on('recordset', recordset => {
        if(!res.headersSent){
            res.writeHead(200, {
                'Transfer-Encoding': 'chunked',
                'Content-Type': 'text/plain',
                'Cache-Control': 'max-age=86400'
            })
            request
            .pipe(csvStream)
            .pipe(new Accumulator())
            .pipe(res);
        }
    })

    request.on('error', err => {
        if(res.headersSent) res.end();
        else res.status(400).end(generateError(err));
    });

    console.log(query);
    request.query(query);
}