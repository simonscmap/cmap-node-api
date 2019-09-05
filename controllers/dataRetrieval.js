const handleCustomQuery = require('../dbHandlers/handleCustomQuery');
const handleStoredProcedure = require('../dbHandlers/handleStoredProcedure');
const StoredProcedureArgumentSet = require('../models/StoredProcedureArgumentSet');
const errors = require('../errorHandling/errorsStrings');
var pools = require('../dbHandlers/dbPools');
const sql = require('mssql');


exports.customQuery = async (req, res, next)=>{
    // Executes a custom written query on the sql server and returns the result as json.
    const query = req.query.query;
    if (!query) {return res.status(500).json({error: errors.customQueryMissing})};

    await handleCustomQuery(query, res);
    req.cmapApiCallDetails.query = query;
    next();
};

exports.storedProcedure = async (req, res, next)=>{
    // Calls a stored procedure with parameters supplied by the user and returns the result as json.
    // req.query is the built-in name for the query string arguments

    // StoredProcedureArgumentSet is not in use because we moved to positional arguments
    // const argSet = new StoredProcedureArgumentSet(req.query);
    // if(!argSet.isValid()) return res.status(500).json({error: errors.storedProcedureArgumentMissing});

    await handleStoredProcedure(req.query, res, next);

    req.cmapApiCallDetails.query = JSON.stringify(req.query);
    next();
};

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

exports.implicit = async (req, res, next) => {
    let argSet = req.query;
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

    request.on('error', err => res.json({error: err.originalError.info.message}));

    // let spExecutionQuery = `EXEC ${argSet.spName} '${argSet.tableName}', '${argSet.fields}', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}'`;
    let spExecutionQuery = `EXEC uspSpaceTime 'tblPisces_NRT', 'Fe', '2012-05-05', '2012-05-05', '32', '34', '-68', '-66', '0', '3'`;
    request.query(spExecutionQuery);    
}