const initializeLogger = require("../../log-service");
const { logMessages, logErrors, logWarnings } = require('../../log-service/log-helpers');
const { getCandidateList } = require("./queryToDatabaseTarget");
const { executeQueryOnCluster } = require("../queryHandler/queryCluster");
const { executeQueryOnPrem } = require("../queryHandler/queryOnPrem");
const { assertPriority, isSproc } = require ("./pure");

const moduleLogger = initializeLogger("router/router");

async function delegateExecution (req, res, next, query, candidates, attempts = 0) {
  let currentAttempt = attempts += 1;

  const log = moduleLogger
    .setReqId(req.requestId)
    .addContext(['query', query ])
    .addContext(['candidates', candidates])
    .addContext(['attempt', currentAttempt]);

  log.trace ("delegate execution called", null);

  let { priorityTargetType } = assertPriority (candidates);

  let targetIsCluster = priorityTargetType === "cluster";
  let queryIsExecutingSproc = isSproc (query);
  let locationListIsNotAnArray = !Array.isArray (candidates);
  let thereIsNoValidTarget = candidates.length === 0 && !queryIsExecutingSproc;

  if (locationListIsNotAnArray || thereIsNoValidTarget) {
    log.error("no candidate servers identified", { candidates, query, attempts });
    res.status(400).send("no candidate servers available for the given query");
    return null;
  }

  // delegate execution and capture result, in the the case of failure, for retry

  // execution functions will return a list of remaining targets if they fail
  let remainingCandidatesAfterFailure;

  // don't allow sprocs to execute on cluster
  if (targetIsCluster && !queryIsExecutingSproc) {
    remainingCandidatesAfterFailure = await executeQueryOnCluster(req, res, next, query);
  } else {
    // if the query is a sproc with no candidates, we will still hit this execute on prem,
    // and without a candidate, it will default to rainier (but if it fails on rainier, it will not run again)
    remainingCandidatesAfterFailure = await executeQueryOnPrem(req, res, next, query, candidates);
  }

  if (Array.isArray(remainingCandidatesAfterFailure) && remainingCandidatesAfterFailure.length > 0) {
    log.info ("allowing retry after failure", { remainingCandidatesAfterFailure });
    return await delegateExecution (req, res, next, query, remainingCandidatesAfterFailure, currentAttempt);
  }

  // no more retries
  log.trace (`execution returned null on attempt #${currentAttempt}, but no error nor retry; calling next`);
  next ();
}

async function routeQuery (req, res, next, query) {
  // each logged message will inclued the request id and query in its context
  const log = moduleLogger
    .setReqId(req.requestId)
    .addContext(['query', query ]);

  log.trace ('routeQuery', null);

  if (typeof query !== "string") {
    log.warn("no query", { typeOfQueryArg: typeof query, originalUrl: req.originalUrl });
    res.status(400).send("missing query");
    next();
    return null;
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
    log.error (respondWithErrorMessage, { candidates: candidateLocations });
    res.status (400).send (respondWithErrorMessage);
    return next('error getting list of candidate servers');
  }

  // 3. delegate execution of the query
  await delegateExecution (req, res, next, query, candidateLocations);
}

async function routeQueryFromMiddleware (req, res, next) {
  let queryFromMiddleware = req.modifiedQuery;
  let output = req.query.output &&
               typeof req.query.output === 'string' &&
               req.query.output.toLowerCase();

  // each logged message will inclued the request id and query in its context
  const log = moduleLogger
    .setReqId(req.requestId)
    .addContext(['query', queryFromMiddleware ]);

  log.trace ('routeQueryFromMiddleware', null);

  if (output === 'project_size') {
    res.json ({
      query: queryFromMiddleware,
      analysis: req.queryAnalysis,
      projectedSize: req.projectedRowCount,
    });
    // stop further middleware from running
    return;
  }

  // retrieve list of candidate servers (provided by middleware)
  let candidateListResults = req.candidateListResults;

  if (!candidateListResults) {
    log.warn("no candidate analysis provided", { candidateListResults });
    res.status(500).send("error preparing query for execution");
    next();
    return null;
  }

  let {
    candidateLocations,
    respondWithErrorMessage,
    errors,
    warnings,
    messages,
  } = candidateListResults;

  // 2. log information from getCandidateList (esp. messages bubbled up from calculateCandidateTargets)
  logErrors (log) (errors);
  logMessages (log) (messages);
  logWarnings (log) (warnings);

  if (respondWithErrorMessage) {
    log.error (respondWithErrorMessage, { candidates: candidateLocations });
    res.status (400).send (respondWithErrorMessage);
    return null;
  }

  // 3. delegate execution of the query
  await delegateExecution (req, res, next, queryFromMiddleware, candidateLocations);
}

module.exports = { routeQuery, routeQueryFromMiddleware };
