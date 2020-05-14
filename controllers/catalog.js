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

exports.auditCatalogVariableNames = async(req, res, next) => {
    let pool = await pools.dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let query = 'SELECT Variable, Table_Name from udfCatalog()';

    let result = await request.query(query);
    let tables = {};

    result.recordset.forEach((record, index) => {
        if(!tables[record.Table_Name]){
            tables[record.Table_Name] = new Set();
        }
        tables[record.Table_Name].add(record.Variable);
    });

    let columns = await request.query('SELECT * FROM INFORMATION_SCHEMA.COLUMNS');

    columns.recordset.forEach((column, index) => {
        if(tables[column.TABLE_NAME]){
            tables[column.TABLE_NAME].delete(column.COLUMN_NAME);
        }
    });

    let response = {};

    for(let table in tables){
        if(tables[table].size > 0){
            response[table] = Array.from(tables[table]);
        }
    }

    res.json(response);
}