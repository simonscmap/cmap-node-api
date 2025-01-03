const { DBSQLClient } = require("@databricks/sql");
const initializeLogger = require("../../log-service");
const moduleLogger = initializeLogger("queryHandler/sparqQuery");
const { tsqlToHiveTransforms } = require('../router/pure');

const connOptions = {
  host: process.env.CLUSTER_HOST,
  path: process.env.CLUSTER_WAREHOUSE_PATH,
  token: process.env.CLUSTER_WAREHOUSE_TOKEN,
};


const makeConnection = async (client, retry, log) => {
  try {
    await client.connect(connOptions);
    log.trace ('success connecting to cluster');
    return;
  } catch (e) {
    log.error("error connecting to cluster", { error: e });
    // don't throw
  }

  if (retry > 5) {
    throw new Error ('failed to connect to client 5 time');
  } else {
    await makeConnection (client, retry + 1, log);
  }
}

// queryCluster :: Query String -> Request Id -> [ Error?, Result ]
const queryCluster = async (query = "", requestId) => {
  const originalQuery = query;
  query = tsqlToHiveTransforms(query);

  let log = moduleLogger
    .setReqId (requestId)
    .addContext(['query', query ]);

  log.debug ('hive sql transform', { originalQuery, transformedQuery: query });

  const client = new DBSQLClient();

  try {
    // await client.connect(connOptions);
    await makeConnection (client, 0, log);
  } catch (e) {
    log.error ("error connecting to cluster", { error: e });
    return [new Error ('error connecting to cluster')];
  }

  let result;
  try {
    log.trace("opening session");
    // Instead of: const session = await client.openSession();
    // See: https://github.com/databricks/databricks-sql-nodejs/issues/77
    const session = await (new Promise((resolve, reject) => {
      client
        .on('error', reject)
        .openSession()
        .then(resolve)
        .catch((e) => reject (e));
    }));

    log.trace("executing query");
    const queryOperation = await session.executeStatement(query, {
      runAsync: true,
      maxRows: 10000,
    });

    log.trace("fetching result");
    result = await queryOperation.fetchAll();

    log.trace("closing operation");
    await queryOperation.close();
    await session.close();
    await client.close();
  } catch (e) {
    log.error("error querrying cluster", { error: e });
    return [e];
  }

  return [null, result];
};

module.exports = queryCluster;
