const handleCustomQuery = require('../dbHandlers/handleCustomQuery');
const handleStoredProcedure = require('../dbHandlers/handleStoredProcedure');
const StoredProcedureArgumentSet = require('../models/StoredProcedureArgumentSet');
const errors = require('../errorHandling/errorsStrings');
var pools = require('../dbHandlers/dbPools');
const sql = require('mssql');

const CSVStream = require('../utility/CSVStream');

const { finished } = require('stream');


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