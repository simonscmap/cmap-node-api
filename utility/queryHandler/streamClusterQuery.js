const { DBSQLClient } = require('@databricks/sql');
const initializeLogger = require('../../log-service');
const stringify = require('csv-stringify');
const AccumulatorStream = require('./AccumulatorStream');
const { CLUSTER_CHUNK_MAX_ROWS } = require('../constants');
const { formatDate, extractTableName } = require('./utility');
const { Readable } = require('stream');
const { tsqlToHiveTransforms } = require('../router/pure');
const generateError = require('../../errorHandling/generateError');

const moduleLogger = initializeLogger(
  'utility/queryHandler/streamClusterQuery',
);

const MAX_ROWS = process.env.CLUSTER_CHUNK_MAX_ROWS || CLUSTER_CHUNK_MAX_ROWS;

const connOptions = {
  host: process.env.CLUSTER_HOST,
  path: process.env.CLUSTER_WAREHOUSE_PATH,
  token: process.env.CLUSTER_WAREHOUSE_TOKEN,
};

const headers = {
  'Transfer-Encoding': 'chunked',
  'Content-Type': 'text/plain',
  'Cache-Control': 'max-age=86400',
};

const streamClusterQuery = async (req, res, next, query) => {
  const startTime = Date.now();
  const originalQuery = query;
  const transformedQuery = tsqlToHiveTransforms(query);
  const tableName = extractTableName(transformedQuery);

  const log = moduleLogger
    .setReqId(req.requestId)
    .addContext(['query', transformedQuery]);

  const endRespWithError = (e) => {
    if (!res.headersSent) {
      res.set('X-Data-Source-Targeted', 'cluster');
      res.set('Access-Control-Expose-Headers', 'X-Data-Source-Targeted');
      res.status(500).send(generateError(e));
    } else {
      res.end();
    }
  };

  // 1. create connection
  const client = new DBSQLClient();

  let hasError = false;

  client.on('error', (e) => {
    log.error('error connecting to cluster', { error: e });
    hasError = true;
  });

  try {
    await client.connect(connOptions);
  } catch (e) {
    log.error('error connecting to cluster', { error: e });
    return null;
  }

  log.trace('opening session');
  const session = await client.openSession();

  log.info('sending query to cluster', { hiveSql: transformedQuery });
  const queryOperation = await session.executeStatement(transformedQuery, {
    runAsync: true,
    maxRows: MAX_ROWS,
  });

  // 2. set up a streamed response
  let accumulator = new AccumulatorStream();
  let csvStream = stringify({
    header: true,
    cast: {
      date: formatDate,
    },
  });

  csvStream.pipe(accumulator).pipe(res);

  let pages = 0;
  let rowCount = 0;

  csvStream.on('error', async (e) => {
    hasError = true;
    log.error('streaming error', {
      requestId: req.requestId,
      userId: req?.user?.id ?? 'unknown',
      functionName: 'streamClusterQuery',
      originalQuery,
      transformedQuery,
      tableName,
      error: e.message,
      durationMs: Date.now() - startTime,
      success: false,
    });
    endRespWithError(e);
  });

  const hasMoreRows = async () => {
    let result = await queryOperation.hasMoreRows();
    log.trace(`has more rows: ${result}; pages: +${pages}`);
    return result;
  };

  // 3. execute
  do {
    log.trace(`start query; page ${pages + 1}`);
    let result;
    try {
      result = await queryOperation.fetchChunk({
        maxRows: MAX_ROWS,
      });
    } catch (e) {
      hasError = true;
      log.error('error fetching chunk', { error: e.message, fullError: e });
      console.log(e);
      endRespWithError(e);
      break;
    }

    if (result) {
      pages++;
      rowCount += result.length;

      if (!res.headersSent) {
        log.trace('writing headers');
        res.set('X-Data-Source-Targeted', 'cluster');
        res.set('Access-Control-Expose-Headers', 'X-Data-Source-Targeted');
        res.writeHead(200, headers);
      }

      log.trace(`creating new readable from result of length ${result.length}`);

      let readable = Readable.from(result);

      // await readable stream finishing
      await new Promise((resolve) => {
        readable.on('end', () => {
          log.trace(`end [readable page ${pages}`);
          resolve();
        });

        // don't close the csvStream when the readable stream has ended
        readable.pipe(csvStream, { end: false });
      });
    }
    // NOTE: ether an error fetching or an error emitted by the stream
    // will cause this loop to terminate
    log.trace(`asking for more rows; error? ${hasError}`);
  } while ((await hasMoreRows()) && !hasError);

  // 4. end
  log.info('finished streaming chunks from cluster', {
    chunks: pages,
    rowCount,
    hasError,
  });

  csvStream.end();

  log.trace('closing operation');

  await queryOperation.close();
  await session.close();
  await client.close();

  log.info('query completed', {
    requestId: req.requestId,
    userId: req?.user?.id ?? 'unknown',
    functionName: 'streamClusterQuery',
    originalQuery,
    transformedQuery,
    tableName,
    rowCount,
    chunks: pages,
    durationMs: Date.now() - startTime,
    success: !hasError,
  });

  return null;
};

module.exports = streamClusterQuery;
