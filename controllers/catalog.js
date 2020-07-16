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

exports.submissionOptions = async(req, res, next) => {
    let pool = await pools.dataReadOnlyPool;

    let request = await new sql.Request(pool);
    let query = `
        SELECT Make FROM tblMakes
        SELECT Sensor FROM tblSensors
        SELECT Study_Domain FROM tblStudy_Domains
        SELECT Temporal_Resolution FROM tblTemporal_Resolutions
        SELECT Spatial_Resolution FROM tblSpatial_Resolutions
    `

    try {
        let result = await request.query(query);
    
        let response = {};

        result.recordsets.forEach(recordset => {
            recordset.forEach(record => {
                let key = Object.keys(record)[0];

                if(!response[key]){
                    response[key] = [];
                }

                response[key].push(record[key]);
            })
        })
    
        res.json(response); 
        next();
    }

    catch {
        return res.sendStatus(500);
    }

}