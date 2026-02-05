const { DBSQLClient } = require('@databricks/sql');
const stringify = require('csv-stringify');
const fs = require('fs');
const Accumulator = require('../../../utility/queryHandler/AccumulatorStream');
const { tsqlToHiveTransforms } = require('../../../utility/router/pure');
const { formatDate } = require('../../../utility/queryHandler/utility');
const { CLUSTER_CHUNK_MAX_ROWS } = require('../../../utility/constants');

const initializeLogger = require('../../../log-service');
const moduleLogger = initializeLogger('bulk-download clusterToDisk');

const MAX_ROWS = process.env.CLUSTER_CHUNK_MAX_ROWS || CLUSTER_CHUNK_MAX_ROWS;

const connOptions = {
  host: process.env.CLUSTER_HOST,
  path: process.env.CLUSTER_WAREHOUSE_PATH,
  token: process.env.CLUSTER_WAREHOUSE_TOKEN,
};

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
    throw new Error('failed to connect to cluster after 5 attempts');
  } else {
    await makeConnection(client, retry + 1, log);
  }
};

const clusterToDisk = async (targetInfo, query, reqId) => {
  const { tempDir, tableName, shortName } = targetInfo;
  const targetPath = `${tempDir}/${shortName}(${tableName}).csv`;

  const log = moduleLogger
    .setReqId(reqId)
    .addContext(['query', query])
    .addContext(['target', targetInfo]);

  const startTime = Date.now();

  const transformedQuery = tsqlToHiveTransforms(query);
  log.info('hive sql transform', { originalQuery: query, transformedQuery });

  const client = new DBSQLClient();

  try {
    await makeConnection(client, 0, log);
  } catch (e) {
    log.error('failed to connect to cluster', { error: e });
    return new Error('failed to connect to cluster');
  }

  let session;
  let queryOperation;
  let hasError = false;

  try {
    log.trace('opening session');
    session = await new Promise((resolve, reject) => {
      client
        .on('error', reject)
        .openSession()
        .then(resolve)
        .catch((e) => reject(e));
    });

    log.info('executing query on cluster');
    queryOperation = await session.executeStatement(transformedQuery, {
      runAsync: true,
      maxRows: MAX_ROWS,
    });

    const csvStream = stringify({
      header: true,
      cast: {
        date: (dateObj) => formatDate(dateObj),
      },
    });

    const accumulator = new Accumulator();
    const targetFile = fs.createWriteStream(targetPath, {
      autoClose: true,
      emitClose: true,
    });

    log.info('starting stream to file', { targetPath, transformedQuery });

    csvStream.pipe(accumulator).pipe(targetFile);

    csvStream.on('error', (err) => {
      log.error('CSV STREAM ERROR', { err });
      hasError = true;
    });

    accumulator.on('error', (err) => {
      log.error('ACCUMULATOR STREAM ERROR', { err });
      hasError = true;
    });

    let rowCount = 0;
    let pages = 0;

    do {
      log.trace(`fetching chunk ${pages + 1}`);
      let result;
      try {
        result = await queryOperation.fetchChunk({
          maxRows: MAX_ROWS,
        });
      } catch (e) {
        hasError = true;
        log.error('error fetching chunk', { error: e.message, fullError: e });
        break;
      }

      if (result) {
        pages++;
        rowCount += result.length;

        log.trace(`writing chunk ${pages} with ${result.length} rows`);

        for (const row of result) {
          let canContinue = csvStream.write(row);
          if (!canContinue) {
            await new Promise((resolve) => csvStream.once('drain', resolve));
          }
        }
      }

      log.trace(`asking for more rows; error? ${hasError}`);
    } while ((await queryOperation.hasMoreRows()) && !hasError);

    if (rowCount === 0 && !hasError) {
      log.warn('empty result set from cluster', { tableName });
      try {
        const schema = await queryOperation.getSchema();
        if (schema && schema.columns) {
          const dummyRow = {};
          schema.columns.forEach((col) => {
            dummyRow[col.columnName] = '';
          });
          csvStream.write(dummyRow);
        }
      } catch (schemaError) {
        log.warn('could not get schema for empty result', { error: schemaError });
      }
    }

    csvStream.end();

    await new Promise((resolve, reject) => {
      targetFile.on('close', () => {
        log.trace(`target file stream closed for ${tableName}`);
        resolve();
      });
      targetFile.on('error', (err) => {
        log.error('TARGET FILE STREAM ERROR', { err });
        reject(err);
      });
    });

    log.info('query completed', {
      requestId: reqId,
      functionName: 'clusterToDisk',
      originalQuery: query,
      transformedQuery,
      tableName,
      rowCount,
      chunks: pages,
      durationMs: Date.now() - startTime,
      success: !hasError,
    });

  } catch (e) {
    hasError = true;
    log.error('query failed', {
      requestId: reqId,
      functionName: 'clusterToDisk',
      originalQuery: query,
      transformedQuery,
      tableName,
      error: e.message,
      errorMessage: e.response && e.response.errorMessage,
      displayMessage: e.response && e.response.displayMessage,
      sqlState: e.response && e.response.sqlState,
      durationMs: Date.now() - startTime,
      success: false,
    });
  } finally {
    try {
      if (queryOperation) {
        log.trace('closing operation');
        await queryOperation.close();
      }
      if (session) {
        await session.close();
      }
      await client.close();
    } catch (closeError) {
      log.warn('error during cleanup', { error: closeError });
    }
  }

  if (hasError) {
    return new Error('cluster query failed');
  }
  return null;
};

module.exports = clusterToDisk;
