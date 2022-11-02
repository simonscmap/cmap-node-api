// const pools = require("../dbHandlers/dbPools");
const sql = require("mssql");
const stringify = require("csv-stringify");
const Accumulator = require("../utility/AccumulatorStream");
const generateError = require("../errorHandling/generateError");
const initializeLogger = require("../log-service");
const { getCandidateList } = require("./queryToDatabaseTarget");
const { roundRobin, mapServerNameToPoolConnection } = require("./roundRobin");
const queryCluster = require("../dbHandlers/sparq");
const { SERVER_NAMES } = require("./constants");

// init logger
const log = initializeLogger("utility/queryHandler");

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
// UTC & simplified ISO 8601
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

const routeQuery = async (req, res, next, query) => {
  if (typeof query !== "string") {
    log.warn("no query", { query, originalUrl: req.originalUrl });
    res.status(400).send("missing query");
  }

  // 0. fetch candidate list
  let {
    commandType,
    priorityTargetType,
    candidateLocations,
  } = await getCandidateList(query);

  const queryIsExecutingSproc = commandType === "sproc";

  if (
    !Array.isArray(candidateLocations) ||
    (candidateLocations.length === 0 && !queryIsExecutingSproc)
  ) {
    log.error("no candidate servers identified", { candidateLocations, query });
    res.status(400).send(`no candidate servers available for the given query`);
    return;
  }

  if (candidateLocations.length === 0 && queryIsExecutingSproc) {
    log.trace("contituing with sproc execution without any table specified");
  }

  const targetIsCluster = priorityTargetType === "cluster";

  if (targetIsCluster) {
    executeQueryOnCluster(req, res, next, query);
  } else {
    executeQueryOnPrem(req, res, next, query, candidateLocations);
  }
};

const executeQueryOnCluster = async (req, res, next, query) => {
  res.set("X-Data-Source-Targeted", "cluster");
  res.set("Access-Control-Expose-Headers", "X-Data-Source-Targeted");
  let result = await queryCluster(query);

  if (!result) {
    res.status(500).send(`query execution error`);
  } else {
    res.send(result);
  }
};

const getPool = async (candidateList = [], serverNameOverride) => {
  let pool;
  let poolName;

  if (serverNameOverride) {
    if (SERVER_NAMES[serverNameOverride]) {
      pool = await mapServerNameToPoolConnection(serverNameOverride);
      poolName = SERVER_NAMES[serverNameOverride];
    } else {
      return { error: true };
    }
  } else {
    // NOTE if roundRobin is passed an empty list, it will return `undefined`
    // which will map to a default pool in the subsequent call to `mapServerNameToPoolConnection`
    poolName = roundRobin(candidateList);
    // this mapping will default to rainier
    pool = await mapServerNameToPoolConnection(
      poolName || SERVER_NAMES.rainier
    );
  }
  return {
    pool,
    poolName,
  };
};

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
  let { pool, poolName, error } = await getPool(
    candidateList.filter((c) => c !== "cluster"),
    serverNameOverride
  );

  if (error) {
    res.status(400).send(`servername "${req.query.servername}" is not valid`);
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

  // 4. handle result, either retry or next()
  // IF  (1) there is an error,
  // AND (2) query was not already run on rainier,
  // AND (3) and no servername was specified
  // AND (4) rainier is in the candidate locations list,
  // THEN rerun on rainier
  // ELSE return next()
  if (
    !req.query.servername &&
    (poolName === SERVER_NAMES.mariana || poolName === SERVER_NAMES.rossby) &&
    requestError === true &&
    candidateList.includes(SERVER_NAMES.rainier)
  ) {
    // Rerun query with forceRainier flag
    log.warning("retrying query on rainier", { query });

    accumulator.unpipe(res);
    await executeQueryOnPrem(req, res, next, query, [], true);
  } else {
    return next();
  }
};

module.exports = routeQuery;
