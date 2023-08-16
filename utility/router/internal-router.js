// This is a version of the data router that does not integrate with expressjs routing
// i.e., does not send responses to a client;
// Used for internal queries that may access distributed data

// NOTE because these requests are not streaming their results to a client, but rather
// accumulating the response in memory, care should be taken not to make requests that
// yield large result sets

const initializeLogger = require("../../log-service");
const { logMessages, logErrors, logWarnings } = require('../../log-service/log-helpers');
const { getCandidateList } = require("./queryToDatabaseTarget");
const clusterQuery = require('../queryHandler/sparqQuery');
const internalQueryOnPrem = require("../queryHandler/internalQueryOnPrem");
const { assertPriority, isSproc } = require ("./pure");

const moduleLogger = initializeLogger("router/internal-router");

async function delegateExecution (query, candidates, requestId, attempts = 0) {
  let currentAttempt = attempts += 1;

  const log = moduleLogger
    .setReqId(requestId)
    .addContext(['query', query ])
    .addContext(['candidates', candidates])
    .addContext(['attempt', currentAttempt]);

  log.trace ("delegate execution [internal] called", null);

  let { priorityTargetType } = assertPriority (candidates);

  let targetIsCluster = priorityTargetType === "cluster";
  let queryIsExecutingSproc = isSproc (query);
  let locationListIsNotAnArray = !Array.isArray (candidates);
  let thereIsNoValidTarget = candidates.length === 0 && !queryIsExecutingSproc;

  if (locationListIsNotAnArray || thereIsNoValidTarget) {
    log.error("no candidate servers identified", { candidates, query, attempts });
    return [new Error ('no candidates for internal query')];
  }

  // don't allow sprocs to execute on cluster
  if (targetIsCluster && !queryIsExecutingSproc) {
    // there are no retries when targeting the cluster, so just return the result
    return await clusterQuery (query, requestId);
  } else {
    // if the query is a sproc with no candidates, we will still hit this execute on prem,
    // and without a candidate, it will default to rainier (but if it fails on rainier, it will not run again)
    let [error, result, remainingCandidates] = await internalQueryOnPrem (query, candidates, requestId);

    // we don't need to check whether the failed query was a sproc without a target; if so, it already
    // ran on Rainier, which was its only viable target; now just chew through the remaining candidates
    if (error && remainingCandidates.length === 0) {
      return [error];
    } else if (error && remainingCandidates.length > 0 ) {
      return await internalQueryOnPrem (query, remainingCandidates, requestId);
    } else if (!error) {
      return [null, result];
    }
  }
}

// :: Query String -> Request Id -> [ Error?, Result ]
async function routeInternalQuery (query, requestId) {
  let log = moduleLogger.setReqId (requestId);
  if (typeof query !== "string") {
    log.warn("no query provided", { query });
    return [new Error ('no query provided to internal router')];
  }

  // 1. preform query analysis; generate list of candidate servers
  let {
    candidateLocations,
    respondWithErrorMessage,
    errors,
    warnings,
    messages,
  } = await getCandidateList(query);

  // 2. log information from getCandidateList (esp. messages bubbled up from calculateCandidateTargets)
  logErrors (log) (errors);
  logMessages (log) (messages);
  logWarnings (log) (warnings);

  if (respondWithErrorMessage) {
    return [new Error (respondWithErrorMessage)];
  }

  // 3. delegate execution of the query
  // :: [ Error?, Result ]
  return await delegateExecution (query, candidateLocations, requestId);
}

module.exports = {
  internalRouter: routeInternalQuery,
}
