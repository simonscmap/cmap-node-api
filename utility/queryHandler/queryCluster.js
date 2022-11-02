const { DBSQLClient } = require("@databricks/sql");
const initializeLogger = require("../../log-service");
const stringify = require("csv-stringify");
const AccumulatorStream = require("./AccumulatorStream");
const { CLUSTER_CHUNK_MAX_ROWS } = require("../constants");
const formatDate = require("./formatDate");


const log = initializeLogger("utility/queryHandler/queryCluster");

const connOptions = {
  host: process.env.CLUSTER_HOST,
  path: process.env.CLUSTER_WAREHOUSE_PATH,
  token: process.env.CLUSTER_WAREHOUSE_TOKEN,
};

const headers = {
  "Transfer-Encoding": "chunked",
  "Content-Type": "text/plain",
  "Cache-Control": "max-age=86400",
};

const executeQueryOnCluster = async (req, res, next, query) => {
  res.set("X-Data-Source-Targeted", "cluster");
  res.set("Access-Control-Expose-Headers", "X-Data-Source-Targeted");

  // 1. create connection
  const client = new DBSQLClient();

  try {
    await client.connect(connOptions);
  } catch (e) {
    log.error("error connecting to cluster", {});
    return;
  }

  log.trace("opening session");
  const session = await client.openSession();

  log.trace("executing statement");
  const queryOperation = await session.executeStatement(query, {
    runAsync: true,
  });

  // 2. set up a streamed response
  let accumulator = new AccumulatorStream();
  let csvStream = stringify({
    // header: true,
    cast: {
      date: formatDate,
    },
  });

  csvStream.pipe(accumulator).pipe(res);

  csvStream.on("error", (e) => {
    log.error("streaming error", { error: e });
  });

  const hasMoreRows = async () => {
    let result = await queryOperation.hasMoreRows();
    console.log("hasMoreRows", result);
    return result;
  }

  // 3. execute
  let schema;
  do {
    let result = await queryOperation.fetchChunk({ maxRows: 500 });
    console.log(result.length);
    csvStream.write(result);
    if (!schema) {
      schema = await queryOperation.getSchema();
      log.debug("schema", { schema });
    }
  } while (await hasMoreRows());

  csvStream.end();


  log.trace("closing operation");
  await queryOperation.close();
  await session.close();
  await client.close();
};

module.exports = {
  executeQueryOnCluster,
};
