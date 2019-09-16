var pools = require('../dbHandlers/dbPools');
const sql = require('mssql');
const stringify = require('csv-stringify')

const errors = require('../errorHandling/errorsStrings');
const CSVStream = require('../utility/CSVStream');
const queryHandler = require('../utility/queryHandler');

exports.customQuery = async (req, res, next)=>{
    queryHandler(req, res, next, req.query.query);
};

exports.storedProcedure = async (req, res, next)=>{
    let argSet = req.query;
    let spExecutionQuery = `EXEC ${argSet.spName} '${argSet.tableName}', '${argSet.fields}', '${argSet.dt1}', '${argSet.dt2}', '${argSet.lat1}', '${argSet.lat2}', '${argSet.lon1}', '${argSet.lon2}', '${argSet.depth1}', '${argSet.depth2}'`;

    queryHandler(req, res, next, spExecutionQuery);
};