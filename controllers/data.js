const queryHandler = require('../utility/queryHandler');

var pools = require('../dbHandlers/dbPools');
const sql = require('mssql');

exports.customQuery = async (req, res, next)=>{
    console.log('query path')
    console.log(req.query.query)
    queryHandler(req, res, next, req.query.query);
};

exports.storedProcedure = async (req, res, next)=>{
    let argSet = req.query;
    let spExecutionQuery = `EXEC ${argSet.spName} '${argSet.tableName}', '${argSet.fields}', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}'`;
    console.log(spExecutionQuery);
    req.cmapApiCallDetails.query = spExecutionQuery;

    queryHandler(req, res, next, spExecutionQuery);
};

exports.cruiseTrajectory = async (req, res, next) => {
    let cruiseID = req.query.id;
    let query = `EXEC uspCruiseTrajectory ${cruiseID}`;

    req.cmapApiCallDetails.query = query;

    queryHandler(req, res, next, query);
}

exports.cruiseList = async (req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let query =  'EXEC uspCruises';
    let result = await request.query(query);
    let cruiseList = result.recordset;
    cruiseList.forEach(cruise => delete cruise.Chief_Email);
    res.json(cruiseList);
}

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