const path = require('path');
const directQuery = require('../../../utility/directQuery');
const { toBuffer, toDisk } = require('./prepareMetadata');
const { createSubDir } = require('./createTempDir');
const { fetchAndPrepareDatasetMetadata } = require('../../catalog');

// Create subdirectory for dataset
const createDatasetDirectory = async (tempDir, shortName, log) => {
  try {
    await createSubDir(tempDir, shortName);
    return path.join(tempDir, shortName);
  } catch (e) {
    log.error('failed to create sub dir', { error: e, tempDir, shortName });
    throw new Error(`failed to create sub dir for ${shortName}`);
  }
};

// Fetch metadata and write to disk
const fetchAndWriteMetadata = async (shortName, dirTarget, reqId, log) => {
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
    return 1; // success indicator
  } catch (e) {
    log.error('failed to write metadata to disk', {
      targetPath,
      shortName,
      error: e,
    });
    throw new Error('failed to write metadata to disk');
  }
};

// Fetch table names for dataset
const fetchTableNames = async (shortName, log) => {
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
    throw new Error(tablesErr);
  }

  return tablesResp.recordset.map(({ Table_Name }) => Table_Name);
};

// Fetch and write all table data
const fetchAndWriteAllTables = async (tables, dirTarget, shortName, reqId, routeQuery, log) => {
  const makeQuery = (t) => `select * from ${t}`;

  const fetchAndWriteJobs = tables.map(
    async (tableName) =>
      await routeQuery(
        { tempDir: dirTarget, tableName, shortName },
        makeQuery(tableName),
        reqId,
      ),
  );

  try {
    return await Promise.all(fetchAndWriteJobs);
  } catch (e) {
    log.error('error in dataFetchAndWrite', { error: e });
    throw new Error('error fething and writing data');
  }
};

module.exports = {
  createDatasetDirectory,
  fetchAndWriteMetadata,
  fetchTableNames,
  fetchAndWriteAllTables,
};