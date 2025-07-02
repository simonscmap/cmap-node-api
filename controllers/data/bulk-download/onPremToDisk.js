const fs = require('fs');
const sql = require('mssql');
const stringify = require('csv-stringify');
const Accumulator = require('../../../utility/queryHandler/AccumulatorStream');
const { getPool } = require('../../../utility/queryHandler/getPool');
const { formatDate } = require('../../../utility/queryHandler/utility');

const initializeLogger = require('../../../log-service');
const moduleLogger = initializeLogger('router onPremToDisk');

// returns null or an array of remaining candidates
const onPremToDisk = async (targetInfo, query, candidateList = [], reqId) => {
  const log = moduleLogger
    .setReqId(reqId)
    .addContext(['candidates', candidateList])
    .addContext(['query', query])
    .addContext(['target', targetInfo]);

  // 1. determine pool

  let { pool, poolName, hasError, remainingCandidates } = await getPool(
    candidateList,
  );

  if (hasError) {
    log.error('getPool failed', {
      candidateList,
      remainingCandidates,
    });
    return remainingCandidates;
  }

  // 2. create request object

  let request = await new sql.Request(pool);

  // stream the response
  // https://www.npmjs.com/package/mssql#streaming
  request.stream = true;

  // track error
  let requestError = false;

  // 3. create stream and define event handlers

  let csvStream = stringify({
    header: true,
    cast: {
      date: (dateObj) => formatDate(dateObj),
    },
  });

  csvStream.on('error', (err) => {
    log.error('CSV STREAM ERROR', { err });
    requestError = true;
  });

  let accumulator = new Accumulator();

  const { tempDir, tableName, shortName } = targetInfo;
  const targetPath = `${tempDir}/${shortName}(${tableName}).csv`;
  const targetFile = fs.createWriteStream(targetPath, {
    autoClose: true,
    emitClose: true,
  });

  log.info('starting stream to file', { targetPath, query, poolName });

  csvStream.pipe(accumulator).pipe(targetFile);

  let count = 0;

  csvStream.on('drain', () => {
    request.resume();
  });

  csvStream.on('finish', () => {
    log.warn('row count', { tableName, count });
  });

  request.on('row', (row) => {
    count++;

    if (csvStream.write(row) === false) {
      request.pause();
    } else {
      //
    }
  });

  request.on('recordset', (r) => {
    // log.trace ('recordset received', {r});
  });

  request.on('done', (data) => {
    log.info(`request stream done for ${tableName}`, {
      rowsAffected: data.rowsAffected,
      rowCount: count,
    });
    if (!requestError) {
      csvStream.end();
    } else {
      log.error(`unpiping accumulator from csvStream for ${tableName}`);
      csvStream.unpipe(accumulator);
    }
  });

  // cancel sql request if file stream closes
  targetFile.on('close', () => {
    log.trace(`write file stream closed for ${tableName}`);
    // request.cancel ();
  });

  let retry = false;

  request.on('error', (err) => {
    requestError = true;

    log.error('error in query handler', {
      poolName,
      query,
      error: err,
    });

    if (remainingCandidates.length === 0) {
      log.info('end response; no more candidates to try after error', {
        remainingCandidates,
      });
      accumulator.unpipe(targetFile);
      // TODO clean up partially written file
    } else if (remainingCandidates.length > 0) {
      log.warn('an error was emitted from the sql request; flagging for retry');
      retry = true;
    } else {
      log.trace('on error catchall; no retry');
    }
  });

  // 4. execute

  try {
    await request.query(query);
  } catch (e) {
    // this block shouldn't run because request.on("error") is defined
    log.error('unexpected error executing query', { error: e });
  }

  return new Promise((resolve, reject) => {
    targetFile.on('close', (d) => {
      log.info(`target file stream closed for ${tableName}`, d);
      if (!requestError || !retry) {
        log.trace('no request error or retry; returning null', { tableName });
        // targetFile.end ();
        resolve(null);
      }

      // 5. SQL Request is now finished but did not succeed;
      // Retry or send error
      if (remainingCandidates.length > 0 && retry === true) {
        log.warn('retrying query with remaining candidates', {
          query,
          remainingCandidates,
        });
        // TODO test whether an accumulator.unpipe for a partially written stream
        // will allow a re-write attempt
        // accumulator.unpipe(targetFile);
        resolve(remainingCandidates);
      } else {
        log.warn(
          'no request error, but no response sent; no remaining candidates servers to try',
          { remainingCandidates },
        );
        targetFile.end();
        reject();
      }
    });
  });
};

module.exports = onPremToDisk;
