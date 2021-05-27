var pools = require('../dbHandlers/dbPools');
const sql = require('mssql');
const stringify = require('csv-stringify')

const Accumulator = require('../utility/AccumulatorStream');
const generateError = require('../errorHandling/generateError');

function formatDate(date) {
    return date.toISOString();
}

const mariana = 'mariana';
const rainier = 'rainier';
const rossby = 'rossby';
const skipLogging = new Set(['ECANCEL']);

// Streaming data handler used by /data routes
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

        else if(req.query.servername === rossby){
            pool = await pools.rossby;
            poolName = rossby;
        }
    }

    else {
        pool = await pools.dataReadOnlyPool;
        poolName = rainier;
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

    let count = 0;
    request.on('row', () => count ++);

    request.on('error', err => {
        requestError = true;
        console.log(err);
        console.log(req.cmapApiCallDetails.query);

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