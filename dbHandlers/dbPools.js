const sql = require('mssql');
const dbConfig = require('../config/dbConfig');

// This connects as a user that has no access to user details and can only read.
module.exports.dataReadOnlyPool = new sql.ConnectionPool(dbConfig.dataRetrievalConfig).connect();

// This connects as a user that has read and write access. Be careful with requests that use this pool
module.exports.userReadAndWritePool = new sql.ConnectionPool(dbConfig.userTableConfig).connect();

module.exports.mariana = new sql.ConnectionPool(dbConfig.mariana).connect();