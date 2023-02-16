const initializeLogger = require("../../log-service");
const { logMessages, logErrors, logWarnings } = require('../../log-service/log-helpers');
const { getCandidateList } = require("./queryToDatabaseTarget");
const { executeQueryOnCluster } = require("../queryHandler/queryCluster");
const { executeQueryOnPrem } = require("../queryHandler/queryOnPrem");
const { COMMAND_TYPES } = require("../constants");
const moduleLogger = initializeLogger("router/router");

const routeQuery = async (req, res, next, query) => {
  // each logged message will inclued the request id and query in its context
  const log = moduleLogger
    .setReqId(req.requestId)
    .addContext(['query', query ]);

  if (typeof query !== "string") {
    log.warn("no query", {
      typeOfQueryArg: typeof query,
      query,
      originalUrl: req.originalUrl,
    });
    res.status(400).send("missing query");
    return next();
  }

  let {
    commandType,
    priorityTargetType,
    candidateLocations,
    respondWithErrorMessage,
    errors,
    warnings,
    messages,
  } = await getCandidateList(query);

  // log information from getCandidateList
  // (and especially messages bubbled up from calculateCandidateTargets)
  logErrors (log) (errors);
  logMessages (log) (messages);
  logWarnings (log) (warnings);

  const queryIsExecutingSproc = commandType === COMMAND_TYPES.sproc;

  if (
    !Array.isArray(candidateLocations) ||
    (candidateLocations.length === 0 && !queryIsExecutingSproc)
  ) {
    log.error((respondWithErrorMessage || "no candidate servers identified"), { candidateLocations, query });
    res.status(400).send(respondWithErrorMessage || `no candidate servers available for the given query`);
    return;
  }

  /* if (candidateLocations.length === 0 && queryIsExecutingSproc) {
     log.trace("continuing with sproc execution without any table specified");
     }
   */

  const targetIsCluster = priorityTargetType === "cluster";

  if (targetIsCluster && !queryIsExecutingSproc) {
    executeQueryOnCluster(req, res, next, query, commandType);
  } else {
    executeQueryOnPrem(req, res, next, query, candidateLocations);
  }
};

module.exports = { routeQuery };
