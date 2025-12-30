const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');
const {
  getCandidateList,
} = require('../../../utility/router/queryToDatabaseTarget');
const { assertPriority } = require('../../../utility/router/pure');
const onPremToDisk = require('./onPremToDisk');
const clusterToDisk = require('./clusterToDisk');
const {
  logMessages,
  logErrors,
  logWarnings,
} = require('../../../log-service/log-helpers');

// with retries
const delegate = async (targetInfo, query, candidateLocations) => {
  let remainingCandidates = await onPremToDisk(
    targetInfo,
    query,
    candidateLocations,
  );

  if (Array.isArray(remainingCandidates)) {
    return delegate(targetInfo, query, remainingCandidates);
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
    return [respondWithErrorMessage];
  }

  let { priorityTargetType } = assertPriority(candidateLocations);
  let targetIsCluster = priorityTargetType === 'cluster';

  if (targetIsCluster) {
    log.info('routing to cluster', { candidateLocations });
    let error = await clusterToDisk(targetInfo, query, reqId);
    if (error) {
      return [error];
    }
    return targetInfo;
  }

  return await delegate(targetInfo, query, candidateLocations, reqId);
};

module.exports = {
  routeQuery,
};