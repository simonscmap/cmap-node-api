const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');
const {
  getCandidateList,
} = require('../../../utility/router/queryToDatabaseTarget');
const onPremToDisk = require('./onPremToDisk');
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

  // 3. delegate execution of the query
  return await delegate(targetInfo, query, candidateLocations, reqId);
};

module.exports = {
  routeQuery,
};