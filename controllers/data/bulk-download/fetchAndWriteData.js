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
const {
  createDatasetDirectory,
  fetchAndWriteMetadata,
  fetchTableNames,
  fetchAndWriteAllTables,
} = require('./dataFetchHelpers');

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

// Fetch and Write Data
// Given a temp dir target and information about a dataset,
// generate and execute the necessary queries to fetch the csv and metadata
// and write them to disk in the temp directory
const fetchAndWriteData = async (tempDir, shortName, reqId, filters = null) => {
  const log = moduleLogger.setReqId(reqId);

  if (typeof shortName !== 'string') {
    throw new Error(`incorrect arg type; expected string, got ${shortName}`);
  }

  // 1. create subdirectory
  const dirTarget = await createDatasetDirectory(tempDir, shortName, log);

  // 2. fetch metadata, create xlsx, & write to disk
  const resultOfMetadataWrite = await fetchAndWriteMetadata(
    shortName,
    dirTarget,
    reqId,
    log,
  );

  // 3. fetch table names
  const tables = await fetchTableNames(shortName, log);

  // 4. fetch and write csv data
  const resultOfDataFetchAndWrites = await fetchAndWriteAllTables(
    tables,
    dirTarget,
    shortName,
    reqId,
    log,
    filters,
  );

  // 5. return results (though nothing is done with the results)
  return [resultOfMetadataWrite, resultOfDataFetchAndWrites];
};

const fetchAll = async (dirTarget, shortNames, reqId, filters = null) => {
  try {
    const result = await Promise.all(
      shortNames.map((shortName) =>
        fetchAndWriteData(dirTarget, shortName, reqId, filters),
      ),
    );
    return [null, result];
  } catch (error) {
    return [error];
  }
};

module.exports = {
  fetchAll,
  routeQuery,
};
