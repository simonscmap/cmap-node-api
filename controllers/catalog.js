const queryHandler = require('../utility/queryHandler');
var pools = require('../dbHandlers/dbPools');
const sql = require('mssql');

exports.retrieve = async (req, res, next) => {
    queryHandler(req, res, next, 'EXEC uspCatalog');
}

exports.datasets = async (req,res,next) => {
    queryHandler(req, res, next, 'SELECT * FROM tblDatasets');
}

exports.description = async (req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    res.cmapSkipCatchAll = true;

    let query =  'SELECT Description FROM [Opedia].[dbo].[tblDatasets] WHERE ID = 1';
    let result = await request.query(query);
    res.json(result.recordset[0]);
}