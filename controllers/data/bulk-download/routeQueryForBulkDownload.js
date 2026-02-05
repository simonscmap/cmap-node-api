const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');
const {
  getCandidateList,
} = require('../../../utility/router/queryToDatabaseTarget');
const onPremToDisk = require('./onPremToDisk');
const clusterToDisk = require('./clusterToDisk');
const { assertPriority, isSproc } = require('../../../utility/router/pure');
const {
  logMessages,
  logErrors,
  logWarnings,
} = require('../../../log-service/log-helpers');

// with retries
const delegate = async (targetInfo, query, candidateLocations, reqId) => {
  let remainingCandidates = await onPremToDisk(
    targetInfo,
    query,
    candidateLocations,
    reqId,
  );

  if (Array.isArray(remainingCandidates)) {
    return delegate(targetInfo, query, remainingCandidates, reqId);
  } else {
    // return targetInfo as token of what operation succeeded
    return targetInfo;
  }
};

// use the data router to determine the correct server to query
const routeQuery = async (targetInfo, query, reqId) => {
  const log = moduleLogger.setReqId(reqId).addContext(['query', query]);

  // 1. preform query analysis; generate list of candidate servers
  let {
    candidateLocations,
    respondWithErrorMessage,
    errors,
    warnings,
    messages,
  } = await getCandidateList(query);

  // 2. log information from getCandidateList (esp. messages bubbled up from calculateCandidateTargets)
  logErrors(log)(errors);
  logMessages(log)(messages);
  logWarnings(log)(warnings);

  if (respondWithErrorMessage) {
    throw new Error(respondWithErrorMessage);
  }

  let { priorityTargetType } = assertPriority(candidateLocations);
  let targetIsCluster = priorityTargetType === 'cluster';
  let queryIsExecutingSproc = isSproc(query);

  if (targetIsCluster && !queryIsExecutingSproc) {
    log.info('routing to cluster', { candidateLocations });
    let result = await clusterToDisk(targetInfo, query, reqId);
    if (result instanceof Error) {
      log.error('cluster query failed', { error: result.message });
      throw result;
    }
    return targetInfo;
  } else {
    return await delegate(targetInfo, query, candidateLocations, reqId);
  }
};

module.exports = {
  routeQuery,
};