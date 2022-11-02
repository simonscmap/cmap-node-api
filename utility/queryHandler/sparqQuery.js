const { DBSQLClient } = require("@databricks/sql");

const initializeLogger = require("../../log-service");
const log = initializeLogger("cluster connect and query");

const connOptions = {
  host: process.env.CLUSTER_HOST,
  path: process.env.CLUSTER_WAREHOUSE_PATH,
  token: process.env.CLUSTER_WAREHOUSE_TOKEN,
};

const queryCluster = async (query = "") => {
  const client = new DBSQLClient();
  // connect
  try {
    await client.connect(connOptions);
  } catch (e) {
    log.error("error connecting to cluster", { });
    return;
  }
  // query
  let result;
  try {
    log.trace("opening session");
    const session = await client.openSession();

    log.trace("executing query");
    const queryOperation = await session.executeStatement(query, {
      runAsync: true,
    });

    log.trace("fetching result");
    result = await queryOperation.fetchAll();

    log.trace("closing operation");
    await queryOperation.close();
    await session.close();
    await client.close();
  } catch (e) {
    log.error("error querrying cluster", { });
  }

  return result;
};

module.exports = queryCluster;
