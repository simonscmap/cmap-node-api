const path = require('path');
const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');
const directQuery = require('../../../utility/directQuery');
const {
  getCandidateList,
} = require('../../../utility/router/queryToDatabaseTarget');
const onPremToDisk = require('./onPremToDisk');
const safePromise = require('../../../utility/safePromise');
const {
  logMessages,
  logErrors,
  logWarnings,
} = require('../../../log-service/log-helpers');
const { toBuffer, toDisk } = require('./prepareMetadata');
const { createSubDir } = require('./createTempDir');
const { fetchAndPrepareDatasetMetadata } = require('../../catalog');

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
const fetchAndWriteData = async (tempDir, shortName, reqId) => {
  const log = moduleLogger.setReqId(reqId);
  // each dataset requires 2 requests: one for the data, the other for metadata

  if (typeof shortName !== 'string') {
    throw new Error(`incorrect arg type; expected string, got ${shortName}`);
  }

  // 1. create subdirectory
  try {
    await createSubDir(tempDir, shortName);
  } catch (e) {
    log.error('failed to create sub dir', { error: e, tempDir, shortName });
    throw new Error(`failed to create sub dir for ${shortName}`);
  }
  const dirTarget = path.join(tempDir, shortName);

  // 2. fetch metadata, create xlsx, & write to disk
  const [metadataErr, metadata] = await fetchAndPrepareDatasetMetadata(
    shortName,
    reqId,
  );
  if (metadataErr) {
    log.error('error fetching metadata', { shortName, metadataErr });
    throw new Error(metadataErr);
  }
  const metaBuf = toBuffer(metadata);
  const targetPath = `${dirTarget}/${shortName}_Metadata.xlsx`;
  try {
    await toDisk(metaBuf, targetPath);
  } catch (e) {
    log.error('failed to write metadata to disk', {
      targetPath,
      shortName,
      error: e,
    });
    throw new Error('failed to write metadata to disk');
  }

  const resultOfMetadataWrite = 1;

  // 3. fetch and write csv data
  const getTableNameQuery = `select distinct Table_Name
    from tblVariables
    where Dataset_ID=(select ID from tblDatasets where Dataset_Name='${shortName}')`;
  const getTableNameOpts = { description: 'get table name' };

  const [tablesErr, tablesResp] = await directQuery(
    getTableNameQuery,
    getTableNameOpts,
    log,
  );
  if (tablesErr) {
    log.error('failed to fetch datatet table name', { error: tablesErr });
    return [tablesErr];
  }

  const tables = tablesResp.recordset.map(({ Table_Name }) => Table_Name);
  const makeQuery = (t) => `select * from ${t}`;

  const fetchAndWriteJobs = tables.map(
    async (tableName) =>
      await routeQuery(
        { tempDir: dirTarget, tableName, shortName },
        makeQuery(tableName),
        reqId,
      ),
  );

  let resultOfDataFetchAndWrites;
  try {
    resultOfDataFetchAndWrites = await Promise.all(fetchAndWriteJobs);
  } catch (e) {
    log.error('error in dataFetchAndWrite', { error: e });
    throw new Error('error fething and writing data');
  }

  // 4. return results (though nothing is done with the results)
  return [resultOfMetadataWrite, resultOfDataFetchAndWrites];
};

const makeFetchJob = (dirTarget, reqId) => (shortName) =>
  fetchAndWriteData(dirTarget, shortName, reqId);

const fetchAll = (dirTarget, shortNames, reqId) =>
  Promise.all(shortNames.map(makeFetchJob(dirTarget, reqId)));

const safeFetchAll = safePromise(fetchAll);

module.exports = safeFetchAll;
