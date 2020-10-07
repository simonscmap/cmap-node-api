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

const mariana = 'mariana';
const rainier = 'rainier';
const skipLogging = new Set(['ECANCEL']);

const handleQuery = async (req, res, next, query, forceRainier) => {
    let pool;
    let poolName;
    // used to avoid calling next if we're retrying on rainier
    let requestError = false;

    if(req.query.servername){
        if(req.query.servername === mariana){
            pool = await pools.mariana;
            poolName = mariana;
        }

        else if(req.query.servername === rainier){
            pool = await pools.dataReadOnlyPool;
            poolName = rainier;
        }
    }

    else {
        // Random load balancing
        if(!forceRainier && Math.random() >= .5){
            pool = await pools.mariana;
            poolName = mariana;
        }
    
        else {
            pool = await pools.dataReadOnlyPool;
            poolName = rainier;
        }
    }

    let request = await new sql.Request(pool);

    request.stream = true;

    res.cmapSkipCatchAll = true;

    let csvStream = stringify({
        header:true,
        cast: {
            date: dateObj => formatDate(dateObj)
        }
    })

    csvStream.on('error', err => {
        if(poolName === rainier){
            if(!res.headersSent) res.status(400).end(err)
            else res.end();
        }
    });

    let accumulator = new Accumulator();

    csvStream
    .pipe(accumulator)
    .pipe(res);
    
    const headers = {
        'Transfer-Encoding': 'chunked',
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=86400'
    }

    request.on('recordset', recordset => {
        if(!res.headersSent){
            res.writeHead(200, headers);
            request.on('row', row => {
                if(csvStream.write(row) === false) request.pause();
            })
        }
    })

    csvStream.on('drain', () => request.resume());
    request.on('done', () => {
        if(poolName === mariana && requestError === true){
            accumulator.unpipe(res);
        }
        csvStream.end();
    });

    // cancel sql request if client closes connection
    req.on('close', () => {
        request.cancel();
    })

    request.on('error', err => {
        requestError = true;

        if(!skipLogging.has(err.code)){
            console.log(`Query failure on ${poolName}:`);
            console.log(req.cmapApiCallDetails.query);
            console.log(req.cmapApiCallDetails.authMethod === 3 ? 'API Key Auth' : 'JWT Auth');
            console.log(err);

            if(res.headersSent) res.end();

            else if(req.query.servername || poolName !== mariana){
               res.status(400).end(generateError(err));
            }
        }
    });

    await request.query(query);

    if(!req.query.servername && poolName === mariana && requestError === true) {
        // Rerun query with forceRainier flag
        accumulator.unpipe(res);
        console.log('retrying on rainier');
        await handleQuery(req, res, next, query, true);
    }

    else return next();
}

module.exports = handleQuery;