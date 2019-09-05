const sql = require('mssql');

var pools = require('./dbPools');

// Calls stored named procedure with the supplied parameters, and 
// streams response to client as gzipped ndjson.
module.exports =  async (argSet, res, next) => { 

    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);
    request.stream = true;

    let variableValues = [];
    let dateSet = new Set();
    let depthSet = new Set();
    let latStart;
    let lonStart;

    res.cmapSkipCatchAll = true;

    request.on('row', row => {
        // First row only
        if(!res.headersSent){
            res.writeHead(200, {
                'Content-Type': 'application/json',
            })
            lonStart = row.lon;
            latStart = row.lat;
        }

        variableValues.push(row[argSet.fields]);
        dateSet.add(row.time.toISOString());
        depthSet.add(row.depth);
    }); 

    request.on('done', () => {
        let dates = Array.from(dateSet.values()).map(date => date.slice(0,10));
        let depths = Array.from(depthSet.values());

        let infoObject = { 
            variableValues,
            dates, 
            depths,
            lonStart,
            latStart
        };

        res.end(JSON.stringify(infoObject));
    });

    request.on('error', err => res.json(err));

    let spExecutionQuery = `EXEC ${argSet.spName} '${argSet.tableName}', '${argSet.fields}', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}'`;
    // let spExecutionQuery = `EXEC uspSpaceTime 'tblPisces_NRT', 'Fe', '2012-05-05', '2012-05-05', '32', '34', '-68', '-66', '0', '3'`;
    console.log(spExecutionQuery);
    request.query(spExecutionQuery);    
};