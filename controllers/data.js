const queryHandler = require('../utility/queryHandler');

var pools = require('../dbHandlers/dbPools');
const sql = require('mssql');

exports.customQuery = async (req, res, next)=>{
    queryHandler(req, res, next, req.query.query);
};

exports.storedProcedure = async (req, res, next)=>{
    let argSet = req.query;
    let spExecutionQuery = `EXEC ${argSet.spName} '${argSet.tableName}', '${argSet.fields}', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}'`;

    queryHandler(req, res, next, spExecutionQuery);
};

exports.cruiseTrajectory = async (req, res, next) => {
    let cruiseID = req.query.id;
    let query = `EXEC uspCruiseTrajectory ${cruiseID}`;

    queryHandler(req, res, next, query);
}

exports.cruiseList = async (req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let query =  'SELECT * FROM udfCruises()';
    let result = await request.query(query);
    let cruiseList = result.recordset;
    cruiseList.forEach(cruise => delete cruise.Chief_Email);
    res.json(cruiseList);
}