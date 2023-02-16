const sql = require("mssql");
const stringify = require("csv-stringify");
const Accumulator = require("./AccumulatorStream");
const generateError = require("../../errorHandling/generateError");
const initializeLogger = require("../../log-service");
const { SERVER_NAMES } = require("../constants");
const { getPool } = require("./getPool");
const formatDate = require("./formatDate");
const log = initializeLogger("utility/queryHandler/queryOnPrem");

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
  // 1. determine pool

  let serverNameOverride = forceRainier ? "rainier" : req.query.servername;
  let onPremCandidates = candidateList.filter((c) => c !== "cluster");
  let { pool, poolName, error } = await getPool(
    onPremCandidates,
    serverNameOverride
  );

  if (error) {
    res.status(400).send(`specified server "${req.query.servername}" is not valid for the given query, consider specifying a different server`);
    next();
    return;
  }

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

  request.on("recordset", (/*recordset*/) => {
    if (!res.headersSent) {
      res.writeHead(200, headers);
      request.on("row", (row) => {
        if (csvStream.write(row) === false) {
          request.pause();
        }
      });
    }
  });

  csvStream.on("drain", () => request.resume());

  request.on("done", () => {
    // TODO Question: why is mariana singled out here?
    if (poolName === SERVER_NAMES.mariana && requestError === true) {
      log.trace("mariana and requestError");
      accumulator.unpipe(res);
    }
    csvStream.end();
  });

  // cancel sql request if client closes connection
  req.on("close", () => {
    request.cancel();
  });

  let count = 0;

  let retry = false;

  request.on("row", () => count++);

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
