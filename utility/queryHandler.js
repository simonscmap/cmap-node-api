const pools = require("../dbHandlers/dbPools");
const sql = require("mssql");
const stringify = require("csv-stringify");
const initializeLogger = require("../log-service");

const Accumulator = require("../utility/AccumulatorStream");
const generateError = require("../errorHandling/generateError");

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

const mariana = "mariana";
const rainier = "rainier";
const rossby = "rossby";
const skipLogging = new Set(["ECANCEL"]);

// Streaming data handler used by /data routes
// - recurses on error
// - chooses database target
const handleQuery = async (req, res, next, query, forceRainier) => {
  // 1. initialize new request with pool

  let pool;
  let poolName;
  let requestError = false;

  if (forceRainier) {
    pool = await pools.dataReadOnlyPool;
    poolName = rainier;
  } else if (req.query.servername) {
    if (req.query.servername === mariana) {
      pool = await pools.mariana;
      poolName = mariana;
    } else if (req.query.servername === rainier) {
      pool = await pools.dataReadOnlyPool;
      poolName = rainier;
    } else if (req.query.servername === rossby) {
      pool = await pools.rossby;
      poolName = rossby;
    }
  } else {
    switch (Math.floor(Math.random() * 3)) {
      case 0:
        pool = await pools.dataReadOnlyPool;
        poolName = rainier;
        break;
      case 1:
        pool = await pools.dataReadOnlyPool;
        poolName = rainier;
        // pool = await pools.mariana;
        // poolName = mariana;
        break;
      case 2:
        pool = await pools.dataReadOnlyPool;
        poolName = rainier;
        // pool = await pools.rossby;
        // poolName = rossby;
        break;
      default:
        pool = pools.dataReadOnlyPool;
        poolName = rainier;
    }
  }

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
    if (poolName === rainier) {
      if (!res.headersSent) {
        res.status(400).end(err);
      } else {
        res.end();
      }
    }
  });

  let accumulator = new Accumulator();

  csvStream.pipe(accumulator).pipe(res);

  request.on("recordset", (recordset) => {
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
    if (poolName === mariana && requestError === true) {
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
      } else if (req.query.servername || poolName === rainier) {
        res.status(400).end(generateError(err));
      } else {
        log.error("unknown error case", { error: err });
      }
    }
  });

  // 3. execute

  await request.query(query);

  // 4. handle result: either retry or next()
  // if there is an error, and query was not already run on ranier, and no servername was specified
  // then rerun on ranier
  if (
    !req.query.servername &&
    (poolName === mariana || poolName === rossby) &&
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
