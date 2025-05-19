const sql = require('mssql');
const stringify = require('csv-stringify');
const Accumulator = require('./AccumulatorStream');
const generateError = require('../../errorHandling/generateError');
const initializeLogger = require('../../log-service');
const { logErrors, logMessages } = require('../../log-service/log-helpers');
const { getPool } = require('./getPool');
const formatDate = require('./formatDate');
const moduleLogger = initializeLogger('router queryOnPrem');

// headers for streamed response
const headers = {
  'Transfer-Encoding': 'chunked',
  'Content-Type': 'text/plain',
  'Cache-Control': 'max-age=86400',
};

const executeQueryOnPrem = async (
  req,
  res,
  next,
  query,
  candidateList = [],
) => {
  const log = moduleLogger
    .setReqId(req.requestId)
    .addContext(['candidates', candidateList])
    .addContext(['query', query]);

  // 1. determine pool

  let serverNameOverride = req.query.servername;

  let { pool, poolName, error, errors, messages, remainingCandidates } =
    await getPool(candidateList, serverNameOverride);

  if (error) {
    logErrors(log)(errors);
    logMessages(log)(messages);

    if (serverNameOverride) {
      res
        .status(400)
        .send(
          `specified server "${req.query.servername}" is not valid for the given query, consider specifying a different server`,
        );
      return null;
    }

    return remainingCandidates;
  }

  logMessages(log)(messages);

  log.info(
    `remaining candidates: ${
      remainingCandidates.length ? remainingCandidates.join(' ') : 'none'
    }`,
  );

  // 2. create request object

  log.debug('making request', { poolName });

  let request = new sql.Request(pool);

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

  csvStream.pipe(accumulator).pipe(res);

  let count = 0;

  csvStream.on('drain', () => {
    request.resume();
  });

  request.on('row', (row) => {
    // TEMP
    if (remainingCandidates.length > 0) {
      // requestError = true;
      // request.emit('error', new Error('oops'));
      // request.cancel();
      // return;
    }
    // END TEMP

    if (!res.headersSent) {
      log.info('writing headers and beginning response stream', {});
      res.set('X-Data-Source-Targeted', poolName || 'default');
      res.set('Access-Control-Expose-Headers', 'X-Data-Source-Targeted');
      res.writeHead(200, headers);
    } else {
      // log.debug ('writing row data; headers have been sent', { headers: res.getHeaders(), count, requestError })
    }

    count++;

    if (csvStream.write(row) === false) {
      request.pause();
    } else {
      //
    }
  });

  request.on('recordset', (r) => {
    log.trace('recordset received', { r });
  });

  request.on('done', (data) => {
    log.info('request stream done', { ...data, rowCount: count });
    if (!requestError) {
      csvStream.end();
    } else {
      // log.info ('unpiping accumulator from csvStream')
      // csvStream.unpipe(accumulator);
      log.warn('not unpiping res, assuming it ended');
    }
  });

  // cancel sql request if client closes connection
  req.on('close', () => {
    log.trace('client closed request');
    request.cancel();
  });

  let retry = false;

  request.on('error', (err) => {
    requestError = true;

    log.error('error in query handler', {
      poolName,
      error: err,
      query: req.cmapApiCallDetails.query,
      authMethod:
        req.cmapApiCallDetails.authMethod === 3 ? 'API Key Auth' : 'JWT Auth',
    });

    if (res.headersSent) {
      log.debug('headers sent', { headers: res.getHeaders() });
    }

    if (remainingCandidates.length === 0) {
      log.error(
        'end response with error; no more candidates to try after error',
        { remainingCandidates },
      );
      accumulator.unpipe(res);
      res.flushHeaders();
      res.status(500).end(generateError(err));
    } else if (remainingCandidates.length > 0) {
      log.warn('an error was emitted from the sql request; flagging for retry');
      retry = true;
    } else {
      log.trace('on error catchall; no retry');
      res.status(500).end(generateError(err));
    }
  });

  // 4. execute

  let resp;
  try {
    resp = await request.query(query);
  } catch (e) {
    // this block shouldn't run because request.on("error") is defined
    log.error('unexpected error executing query', { error: e });
  }

  if (!requestError || !retry) {
    log.trace('no request error or retry; returning null', {
      requestError,
      retry,
    });
    console.log(resp);
    res.end();
    return null;
  }

  // 5. SQL Request is now finished; Retry or send error
  if (remainingCandidates.length > 0 && retry === true) {
    log.warn('retrying query with remaining candidates', {
      query,
      remainingCandidates,
    });
    res.flushHeaders();
    accumulator.unpipe(res);
    return remainingCandidates;
  } else {
    log.warn(
      'no request error, but no response sent; no remaining candidates servers to try',
      { remainingCandidates },
    );
    if (!res.headersSent) {
      res
        .status(500)
        .send(
          'an unknown error occurred, and there are no remaining servers on which to reexecute the query',
        );
    } else {
      res.end();
    }
    return null;
  }
};

module.exports = {
  executeQueryOnPrem,
};
