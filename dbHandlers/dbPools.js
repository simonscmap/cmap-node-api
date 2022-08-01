const sql = require("mssql");
const dbConfig = require("../config/dbConfig");
const Future = require("fluture");

// Note, the mssql ConnectionPool connect method returns a promise

const pools = {
  // This connects as a user that has no access to user details and can only read.
  dataReadOnlyPool: new sql.ConnectionPool(
    dbConfig.dataRetrievalConfig
  ).connect(),
  // This connects as a user that has read and write access. Be careful with requests that use this pool
  userReadAndWritePool: new sql.ConnectionPool(
    dbConfig.userTableConfig
  ).connect(),
  // Mariana
  mariana: new sql.ConnectionPool(dbConfig.mariana).connect(),
  // Rossby
  rossby: new sql.ConnectionPool(dbConfig.rossby).connect(),
};

module.exports = {
  dataReadOnlyPool: pools.dataReadOnlyPool,
  userReadAndWritePool: pools.userReadAndWritePool,
  mariana: pools.mariana,
  rossby: pools.rossby,
  // also return Futures of these pool connections
  futures: {
    dataReadOnlyPool: Future.attemptP(() => pools.dataReadOnlyPool),
    userReadAndWritePool: Future.attemptP(() => pools.userReadAndWritePool),
  },
};
