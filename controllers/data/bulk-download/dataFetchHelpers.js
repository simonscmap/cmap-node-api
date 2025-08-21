const path = require('path');
const directQuery = require('../../../utility/directQuery');
const { toBuffer, toDisk } = require('./prepareMetadata');
const { createSubDir } = require('./createTempDir');
const { fetchAndPrepareDatasetMetadata } = require('../../catalog');
const generateQueryFromConstraints = require('../generateQueryFromConstraints');
const { routeQuery } = require('./routeQueryForBulkDownload');
// Transform API filters to internal constraint format
const parseFiltersToConstraints = (filters) => {
  if (!filters) {
    return null;
  }

  const constraints = {};

  // Transform temporal filters
  if (filters.temporal) {
    constraints.time = {};
    if (filters.temporal.startDate) {
      constraints.time.min = filters.temporal.startDate;
    }
    if (filters.temporal.endDate) {
      constraints.time.max = filters.temporal.endDate;
    }
  }

  // Transform spatial filters
  if (filters.spatial) {
    if (
      filters.spatial.latMin !== undefined ||
      filters.spatial.latMax !== undefined
    ) {
      constraints.lat = {};
      if (filters.spatial.latMin !== undefined) {
        constraints.lat.min = filters.spatial.latMin;
      }
      if (filters.spatial.latMax !== undefined) {
        constraints.lat.max = filters.spatial.latMax;
      }
    }

    if (
      filters.spatial.lonMin !== undefined ||
      filters.spatial.lonMax !== undefined
    ) {
      constraints.lon = {};
      if (filters.spatial.lonMin !== undefined) {
        constraints.lon.min = filters.spatial.lonMin;
      }
      if (filters.spatial.lonMax !== undefined) {
        constraints.lon.max = filters.spatial.lonMax;
      }
    }
  }

  // Transform depth filters
  if (filters.depth) {
    constraints.depth = {};
    if (filters.depth.min !== undefined) {
      constraints.depth.min = filters.depth.min;
    }
    if (filters.depth.max !== undefined) {
      constraints.depth.max = filters.depth.max;
    }
  }

  return Object.keys(constraints).length > 0 ? constraints : null;
};

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
const fetchAndWriteMetadata = async (shortName, dirTarget, reqId, log, metadata) => {
  if (!metadata) {
    throw new Error('metadata parameter is required');
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
const fetchAndWriteAllTables = async (
  tables,
  dirTarget,
  shortName,
  reqId,
  log,
  filters = null,
  metadata,
  constraints = null,
) => {
  // Use passed constraints or fallback to parsing filters if constraints not provided
  const finalConstraints = constraints || parseFiltersToConstraints(filters);

  // If we have constraints, we need dataset metadata for proper query generation
  let datasetMetadata = null;
  if (finalConstraints) {
    if (!metadata) {
      throw new Error('metadata parameter is required when applying constraints');
    }
    datasetMetadata = metadata.dataset;
  }

  const makeQuery = (tableName) => {
    if (finalConstraints && datasetMetadata) {
      // Use existing generateQueryFromConstraints system with data query type
      const query = generateQueryFromConstraints(
        tableName,
        finalConstraints,
        datasetMetadata,
        'data',
      );
      return query;
    } else {
      // Fallback to full table query
      return `select * from ${tableName}`;
    }
  };

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
  parseFiltersToConstraints,
};
