const sql = require('mssql');
const nodeCache = require('../../utility/nodeCache');
const pools = require('../../dbHandlers/dbPools');
const logInit = require('../../log-service');
const moduleLogger = logInit('controllers/collections');

// This is the main collections controller index file
// Individual controllers will be added here as they are implemented

module.exports = {
  list: require('./list'),
  detail: require('./detail'),
  queries: require('./queries'),
};
