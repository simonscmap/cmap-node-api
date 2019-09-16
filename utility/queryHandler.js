var pools = require('../dbHandlers/dbPools');
const sql = require('mssql');
const stringify = require('csv-stringify')

const Accumulator = require('../utility/AccumulatorStream');

function formatDate(date) {
    let month  = date.getMonth() + 1;
    let day = date.getDate();
    let year = date.getFullYear();

    return [year, month < 10 ? '0' + month : month, day < 10 ? '0' + day : day].join('-');
}

module.exports = async (req, res, next, query) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);
    request.stream = true;

    res.cmapSkipCatchAll = true;

    let csvStream = stringify({
        header:true,
        cast: {
            date: dateObj => formatDate(dateObj)
        }
    })

    csvStream.on('error', err => res.status(400).end(err));

    request.on('recordset', recordset => {
        if(!res.headersSent){
            res.writeHead(200, {
                'Transfer-Encoding': 'chunked',
                'Content-Type': 'text/plain'
            })
            request
            .pipe(csvStream)
            .pipe(new Accumulator())
            .pipe(res);
        }
    })

    request.on('error', err => res.status(400).end(err.originalError.info.message));
    console.log(query);
    request.query(query);
}