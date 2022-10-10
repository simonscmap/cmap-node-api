// const pools = require("../dbHandlers/dbPools");
const sql = require("mssql");
const stringify = require("csv-stringify");
const Accumulator = require("../utility/AccumulatorStream");
const generateError = require("../errorHandling/generateError");
const initializeLogger = require("../log-service");
const { getCandidateList } = require("./queryToDatabaseTarget");
const { roundRobin, mapServerNameToPoolConnection } = require("./roundRobin");
const { SERVER_NAMES } = require("./constants");

// init logger
const log = initializeLogger("utility/queryHandler");

function formatDate(date) {
  return date.toISOString();
}

// headers for streamed response
const headers = {
  "Transfer-Encoding": "chunked",
  "Content-Type": "text/plain",
  "Cache-Control": "max-age=86400",
};

const skipLogging = new Set(["ECANCEL"]);

// Streaming data handler used by /data routes
// - recurses on error
// - chooses database target
const handleQuery = async (req, res, next, query, forceRainier) => {
  // 0. fetch candidate list
  let candidateList = await getCandidateList(query);
  log.debug("candidate list", { candidateList, query });

  // 1. initialize new request with pool

  let pool;
  let poolName; // used to determine if there should be a retry
  let requestError = false;

  if (forceRainier) { // TODO question: allow force ranied if it is not in candidate list?
    pool = await mapServerNameToPoolConnection(SERVER_NAMES.ranier);
    poolName = SERVER_NAMES.ranier;
  } else if (req.query.servername) {
    if (SERVER_NAMES[req.query.servername]) {
      pool = await mapServerNameToPoolConnection(req.query.servername);
      poolName = SERVER_NAMES[req.query.servername];
    } else {
      res.status(400).send(`servername ${req.query.servername} is not valid`);
      return;
    }
  } else {
    poolName = roundRobin(candidateList);
    pool = await mapServerNameToPoolConnection(poolName);
  }

  log.debug("making request", { poolName });

  let request = await new sql.Request(pool);

  // stream the response
  // https://www.npmjs.com/package/mssql#streaming
  request.stream = true;

  // 2. create stream and define event handlers

  let csvStream = stringify({
    header: true,
    cast: {
      date: (dateObj) => formatDate(dateObj),
    },
  });

  csvStream.on("error", (err) => {
    // if the query targeted ranier, we will not re-try it
    if (poolName === SERVER_NAMES.ranier) {
      if (!res.headersSent) {
        res.status(400).end(err);
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
      log.trace("mariana or requestError");
      accumulator.unpipe(res);
    }
    csvStream.end();
  });

  // cancel sql request if client closes connection
  req.on("close", () => {
    request.cancel();
  });

  let count = 0;

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
      } else if (req.query.servername || poolName === SERVER_NAMES.ranier) {
        res.status(400).end(generateError(err));
      } else {
        log.error("unknown error case", { error: err });
      }
    }
  });

  // 3. execute

  try {
    await request.query(query);
  } catch (e) {
    res.status(500).send(`query execution error`);
    log.error("error executing query", { error: e });
    return;
  }

  // 4. handle result: either retry or next()
  // if there is an error, and query was not already run on ranier, and no servername was specified
  // then rerun on ranier
  if (
    !req.query.servername &&
    (poolName === SERVER_NAMES.mariana || poolName === SERVER_NAMES.rossby) &&
    requestError === true
  ) {
    // Rerun query with forceRainier flag
    accumulator.unpipe(res);

    log.warning("retrying query on ranier", {
      query: req.cmapApiCallDetails.query,
    });

    await handleQuery(req, res, next, query, true);
  } else {
    return next();
  }
};

module.exports = handleQuery;
