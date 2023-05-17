const sql = require("mssql");
const stringify = require("csv-stringify");
const Accumulator = require("./AccumulatorStream");
const generateError = require("../../errorHandling/generateError");
const initializeLogger = require("../../log-service");
const { logErrors, logMessages } = require('../../log-service/log-helpers');
const { SERVER_NAMES } = require("../constants");
const { getPool } = require("./getPool");
const formatDate = require("./formatDate");
const moduleLogger = initializeLogger("router queryOnPrem");

// headers for streamed response
const headers = {
  "Transfer-Encoding": "chunked",
  "Content-Type": "text/plain",
  "Cache-Control": "max-age=86400",
};

const skipLogging = new Set(["ECANCEL"]);

const executeQueryOnPrem = async (
  req,
  res,
  next,
  query,
  candidateList = [],
  forceRainier
) => {
  const log = moduleLogger.setReqId(req.requestId);
  // 1. determine pool

  let serverNameOverride = req.query.servername;

  let onPremCandidates = candidateList.filter((c) => c !== "cluster");

  let { pool, poolName, error, errors, messages} = await getPool(
    onPremCandidates,
    serverNameOverride,
    forceRainier
  );

  if (error) {
    logErrors (log) (errors);
    res.status(400).send(`specified server "${req.query.servername}" is not valid for the given query, consider specifying a different server`);
    next();
    return;
  }

  logMessages (log) (messages);

  res.set("X-Data-Source-Targeted", poolName || "default");
  res.set("Access-Control-Expose-Headers", "X-Data-Source-Targeted");

  // 2. create request object

  log.debug("making request", { poolName });

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

  csvStream.on("error", (err) => {
    // if the query targeted rainier, we will not re-try it
    if (poolName === SERVER_NAMES.rainier) {
      if (!res.headersSent) {
        res.status(500).end(err);
      } else {
        res.end();
      }
    }
  });

  let accumulator = new Accumulator();

  csvStream.pipe(accumulator).pipe(res);

  let count = 0;

  request.on("row", (row) => {
    if (!res.headersSent) {
      log.info ("beginning response stream", {});
      res.writeHead(200, headers);
    }

    count++;

    if (csvStream.write(row) === false) {
      request.pause();
    }
  });

  request.on("recordset", () => {
    log.trace ('recordset received', {});
  });


  csvStream.on("drain", () => request.resume());

  request.on("done", (data) => {
    // TODO Question: why is mariana singled out here?
    if (poolName === SERVER_NAMES.mariana && requestError === true) {
      log.trace("mariana and requestError");
      accumulator.unpipe(res);
    } else {
      log.info ("request stream done", { ...data, rowCount: count });
    }
    csvStream.end();
  });

  // cancel sql request if client closes connection
  req.on("close", () => {
    request.cancel();
  });


  let retry = false;


  request.on("error", (err) => {
    requestError = true;

    if (!skipLogging.has(err.code)) {
      log.error("error in query handler", {
        poolName,
        error: err,
        query: req.cmapApiCallDetails.query,
        authMethod:
          req.cmapApiCallDetails.authMethod === 3 ? "API Key Auth" : "JWT Auth",
      });

      if (res.headersSent) {
        res.end();
        log.trace("end response; headers already set");
      } else if (req.query.servername || poolName === SERVER_NAMES.rainier) {
        res.status(500).end(generateError(err));
      } else if (candidateList.includes(SERVER_NAMES.rainier)) {
        log.warn ("on error; flagging retry");
        retry = true;
      } else {
        log.trace("on error catchall; no retry");
        res.status(500).end(generateError(err));
      }
    }
  });

  // 4. execute

  try {
    await request.query(query);
  } catch (e) {
    // this block shouldn't run because request.on("error") is defined
    log.error("unexpected error executing query", { error: e });
    return;
  }

  if (!requestError) {
    log.trace ('no request error; returning next()');
    return next();
  }

  // 4. handle result, either retry or next()
  // IF  (1) there is an error,
  // AND (2) query was not already run on rainier,
  // AND (3) and no servername was specified
  // AND (4) rainier is in the candidate locations list,
  // THEN rerun on rainier
  // ELSE return next()
  log.trace("determining retry option", { retryFlag: retry });

  if (
    !req.query.servername &&
    (poolName === SERVER_NAMES.mariana || poolName === SERVER_NAMES.rossby) &&
    candidateList.includes(SERVER_NAMES.rainier)
  ) {
    // Rerun query with forceRainier flag
    log.warn("retrying query on rainier", { query });
    accumulator.unpipe(res);
    await executeQueryOnPrem(req, res, next, query, [], true);
  } else {
    log.trace("defer to next()");
    return next();
  }
};

module.exports = {
  executeQueryOnPrem,
};
