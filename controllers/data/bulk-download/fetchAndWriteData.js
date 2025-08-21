const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');
const {
  createDatasetDirectory,
  fetchAndWriteMetadata,
  fetchTableNames,
  fetchAndWriteAllTables,
} = require('./dataFetchHelpers');


// Fetch and Write Data
// Given a temp dir target and information about a dataset,
// generate and execute the necessary queries to fetch the csv and metadata
// and write them to disk in the temp directory
const fetchAndWriteData = async (tempDir, shortName, reqId, filters = null, metadata = null) => {
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
    metadata,
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
    metadata,
  );

  // 5. return results (though nothing is done with the results)
  return [resultOfMetadataWrite, resultOfDataFetchAndWrites];
};

module.exports = {
  fetchAndWriteData,
};
