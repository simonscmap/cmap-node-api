const { DBSQLClient } = require('@databricks/sql');
const { tsqlToHiveTransforms } = require('../../../utility/router/pure');
const { CLUSTER_CHUNK_MAX_ROWS } = require('../../../utility/constants');
const initializeLogger = require('../../../log-service');

const moduleLogger = initializeLogger('bulk-download clusterToDisk');

const MAX_ROWS = process.env.CLUSTER_CHUNK_MAX_ROWS || CLUSTER_CHUNK_MAX_ROWS;

const connOptions = {
  host: process.env.CLUSTER_HOST,
  path: process.env.CLUSTER_WAREHOUSE_PATH,
  token: process.env.CLUSTER_WAREHOUSE_TOKEN,
};

// pattern from runClusterQuery.js
const makeConnection = async (client, retry, log) => {
  try {
    await client.connect(connOptions);
    log.trace('success connecting to cluster');
    return;
  } catch (e) {
    log.error('error connecting to cluster', { error: e });
    // don't throw
  }

  if (retry > 5) {
    throw new Error('failed to connect to cluster 5 times');
  } else {
    await makeConnection(client, retry + 1, log);
  }
};

const clusterToDisk = async (targetInfo, query, reqId) => {
  const startTime = Date.now();
  const { tableName} = targetInfo;

  const log = moduleLogger
    .setReqId(reqId)
    .addContext(['query', query])
    .addContext(['target', targetInfo]);

  // 1. Transform T-SQL to Hive SQL
  const originalQuery = query;
  const transformedQuery = tsqlToHiveTransforms(query);

  log.info('hive sql transform', { originalQuery, transformedQuery });

  // 2. Connect to Databricks (with retry logic)
  const client = new DBSQLClient();

  try {
    await makeConnection(client, 0, log);
  } catch (e) {
    log.error('error connecting to cluster', { error: e });
    return new Error('error connecting to cluster');
  }

  let session;
  let queryOperation;

  try {
    // 3. Open session
    log.trace('opening session');
    session = await new Promise((resolve, reject) => {
      client
        .on('error', reject)
        .openSession()
        .then(resolve)
        .catch((e) => reject(e));
    });

    // 4. Execute query
    log.info('executing query on cluster');
    queryOperation = await session.executeStatement(transformedQuery, {
      runAsync: true,
      maxRows: MAX_ROWS,
    });
    log.trace('closing operation');
    await queryOperation.close();
    await session.close();
    await client.close();


  } catch (e) {
    log.error('query failed', {
      originalQuery,
      transformedQuery,
      tableName,
      error: e.message,
      errorMessage: e.response && e.response.errorMessage,
      displayMessage: e.response && e.response.displayMessage,
      sqlState: e.response && e.response.sqlState,
      durationMs: Date.now() - startTime,
      success: false,
    });
    return e;
  } 
};

module.exports = clusterToDisk;
