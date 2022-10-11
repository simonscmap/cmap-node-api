// const pools = require("../dbHandlers/dbPools");
const sql = require("mssql");
const stringify = require("csv-stringify");
const Accumulator = require("../utility/AccumulatorStream");
const generateError = require("../errorHandling/generateError");
const initializeLogger = require("../log-service");
const { getCandidateList, isSPROC } = require("./queryToDatabaseTarget");
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

  if (!candidateList || candidateList.length === 0 && !isSPROC(query)) {
    log.error("no candidate servers identified", { candidateList, query });
    res.status(400).send(`no candidate servers available for the given query`);
    return;
  }

  if (candidateList.length === 0 && isSPROC(query)) {
    log.trace("contituing with sproc execution without any table specified");
  }

  // 1. initialize new request with pool
  let pool;
  let poolName; // used to determine if there should be a retry
  let requestError = false;

  if (forceRainier) { // this flag is only set after determining rainier is a candidate
    pool = await mapServerNameToPoolConnection(SERVER_NAMES.rainier);
    poolName = SERVER_NAMES.rainier;
  } else if (req.query.servername) {
    if (SERVER_NAMES[req.query.servername]) {
      pool = await mapServerNameToPoolConnection(req.query.servername);
      poolName = SERVER_NAMES[req.query.servername];
    } else {
      res.status(400).send(`servername "${req.query.servername}" is not valid`);
      return;
    }
  } else {
    // NOTE if roundRobin is passed an empty list, it will return `undefined`
    // which will map to a default pool in the subsequent call to `mapServerNameToPoolConnection`
    poolName = roundRobin(candidateList);
    // this mapping will default to rainier
    pool = await mapServerNameToPoolConnection(poolName || SERVER_NAMES.rainier);
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
      } else if (req.query.servername || poolName === SERVER_NAMES.rainier) {
        res.status(500).end(generateError(err));
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
  // IF (1) there is an error, and (2) query was not already run on rainier,
  // and (3) and no servername was specified
  // and (4) rainier is in the candidate locations list,
  // THEN rerun on rainier
  if (
    !req.query.servername &&
    (poolName === SERVER_NAMES.mariana || poolName === SERVER_NAMES.rossby) &&
    requestError === true &&
    candidateList.includes(SERVER_NAMES.rainier)
  ) {
    // Rerun query with forceRainier flag
    log.warning("retrying query on rainier", {
      query: req.cmapApiCallDetails.query,
    });

    accumulator.unpipe(res);
    await handleQuery(req, res, next, query, true);
  } else {
    return next();
  }
};

module.exports = handleQuery;
