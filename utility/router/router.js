const initializeLogger = require("../../log-service");
const { logMessages, logErrors, logWarnings } = require('../../log-service/log-helpers');
const { getCandidateList } = require("./queryToDatabaseTarget");
const { executeQueryOnCluster } = require("../queryHandler/queryCluster");
const { executeQueryOnPrem } = require("../queryHandler/queryOnPrem");
const { COMMAND_TYPES } = require("../constants");
const { assertPriority } = require ("./pure");
const moduleLogger = initializeLogger("router/router");

async function routeQuery (req, res, next, query, retryCandidates) {
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
    next();
    return null;
  }


  // This is a retry
  if (retryCandidates && retryCandidates.length > 0) {
    let { priorityTargetType } = assertPriority (retryCandidates);

    log.info ('executing retry', { targetType: priorityTargetType });

    // delegate execution and capture result, in the the case of failure, for retry
    let remainingCandidatesAfterFailure;

    if (priorityTargetType === 'cluster') {
      remainingCandidatesAfterFailure = await executeQueryOnCluster(req, res, next, query);
    } else {
      remainingCandidatesAfterFailure = await executeQueryOnPrem(req, res, next, query, retryCandidates);
    }

    if (Array.isArray(remainingCandidatesAfterFailure) && remainingCandidatesAfterFailure.length > 0) {
      // retry again
      log.info ('initiating another retry', { remainingCandidatesAfterFailure });
      return await routeQuery (req, res, next, query, remainingCandidatesAfterFailure);
    } else {
      log.debug ('finished retry, no more candidates', { remainingCandidatesAfterFailure });
      next ();
      return null;
    }
  }

  log.trace ('no retry; proceeding with query analysis and initial execution');

  // This is the first execution attempt, calculate candidates

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
    return null;
  }

  const targetIsCluster = priorityTargetType === "cluster";

  // delegate execution and capture result, in the the case of failure, for retry
  let remainingCandidatesAfterFailure;
  if (targetIsCluster && !queryIsExecutingSproc) {
    remainingCandidatesAfterFailure = await executeQueryOnCluster(req, res, next, query);
  } else {
    remainingCandidatesAfterFailure = await executeQueryOnPrem(req, res, next, query, candidateLocations);
  }

  log.debug ("checking if there are remainingCandidatesAfterFailure", { remainingCandidatesAfterFailure });

  if (Array.isArray(remainingCandidatesAfterFailure) && remainingCandidatesAfterFailure.length > 0) {
    log.info ("initiating first retry", { remainingCandidatesAfterFailure });
    return await routeQuery (req, res, next, query, remainingCandidatesAfterFailure);
  } else {
    log.info ('execution returned null; no error or retry; calling next');
    next ();
  }
}

module.exports = { routeQuery };
