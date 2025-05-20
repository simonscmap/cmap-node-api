const sql = require('mssql');
const dbConfig = require('../config/dbConfig');
const Future = require('fluture');
const { SERVER_NAMES } = require('../utility/constants');
const logInit = require('../log-service');
const log = logInit('dbPools');

// Note, the mssql ConnectionPool connect method returns a promise
const rainierReadOnly = new sql.ConnectionPool(dbConfig.dataRetrievalConfig)
  .connect()
  .catch((error) => {
    log.error('Failed to connect to rainierReadOnly pool', { error });
    return null;
  });

const rainierReadWrite = new sql.ConnectionPool(dbConfig.userTableConfig)
  .connect()
  .catch((error) => {
    log.error('Failed to connect to rainierReadWrite pool', { error });
    return null;
  });

const rossby = new sql.ConnectionPool(dbConfig.rossby)
  .connect()
  .catch((error) => {
    log.error('Failed to connect to rossby pool', { error });
    return null;
  });

const pools = {
  // This connects as a user that has no access to user details and can only read.
  dataReadOnlyPool: rainierReadOnly,

  // This connects as a user that has read and write access. Be careful with requests that use this pool
  userReadAndWritePool: rainierReadWrite,

  // Mariana
  // TEMPORARILY REMOVE MARIANA FOR MAINTENANCE
  // [SERVER_NAMES.mariana]: new sql.ConnectionPool(dbConfig.mariana).connect(),
  //
  // Rossby
  [SERVER_NAMES.rossby]: rossby,
  [SERVER_NAMES.rainier]: rainierReadOnly,
  rainierReadWrite: rainierReadWrite,
};

module.exports = {
  ...pools,
  // also return Futures of these pool connections
  futures: {
    dataReadOnlyPool: Future.attemptP(() => pools.dataReadOnlyPool),
    userReadAndWritePool: Future.attemptP(() => pools.userReadAndWritePool),
  },
};
