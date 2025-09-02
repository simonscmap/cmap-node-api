const path = require('path');
const directQuery = require('../../../utility/directQuery');
const { toBuffer, toDisk } = require('./prepareMetadata');
const { createSubDir } = require('./tempDirUtils');
const generateQueryFromConstraints = require('../generateQueryFromConstraints');
const { routeQuery } = require('./routeQueryForBulkDownload');
const sql = require('mssql');
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
const fetchAndWriteMetadata = async (
  shortName,
  dirTarget,
  reqId,
  log,
  metadata,
) => {
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
  metadata,
  constraints = null,
) => {
  const makeQuery = (tableName) => {
    if (constraints) {
      // Use existing generateQueryFromConstraints system with data query type
      const query = generateQueryFromConstraints(
        tableName,
        constraints,
        metadata,
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

const fetchDatasetsMetadata = async (shortNames, log) => {
  const shortNamesJson = JSON.stringify(shortNames);

  const query = `
    DECLARE @shortNames nvarchar(max) = @shortNamesParam;

    WITH
        requested
        AS
        (
            SELECT value AS shortName, [key] AS ord
            FROM OPENJSON(@shortNames)
        ),
        resolved
        AS
        (
            SELECT r.ord, r.shortName, d.ID AS Dataset_ID, d.Dataset_Name
            FROM requested r
                LEFT JOIN dbo.tblDatasets d
                ON d.Dataset_Name = r.shortName
        ),
        joined
        AS
        (
            SELECT z.ord, z.shortName, z.Dataset_ID, z.Dataset_Name, s.JSON_stats
            FROM resolved z
                LEFT JOIN dbo.tblDataset_Stats s
                ON s.Dataset_ID = z.Dataset_ID
        )
    SELECT
        (
      SELECT
            j.Dataset_Name AS [Dataset_Name],
            CAST(ROUND(TRY_CONVERT(float, JSON_VALUE(j.JSON_stats, '$.lat.min')), 8) AS decimal(18,8)) AS [Lat_Min],
            CAST(ROUND(TRY_CONVERT(float, JSON_VALUE(j.JSON_stats, '$.lat.max')), 8) AS decimal(18,8)) AS [Lat_Max],
            CAST(ROUND(TRY_CONVERT(float, JSON_VALUE(j.JSON_stats, '$.lon.min')), 8) AS decimal(18,8)) AS [Lon_Min],
            CAST(ROUND(TRY_CONVERT(float, JSON_VALUE(j.JSON_stats, '$.lon.max')), 8) AS decimal(18,8)) AS [Lon_Max],
            JSON_VALUE(j.JSON_stats, '$.time.min') AS [Time_Min],
            JSON_VALUE(j.JSON_stats, '$.time.max') AS [Time_Max],
            TRY_CAST(TRY_CONVERT(float, JSON_VALUE(j.JSON_stats, '$.lon.count')) AS bigint) AS [Row_Count]
        FROM joined j
        WHERE j.Dataset_ID IS NOT NULL
            AND j.JSON_stats IS NOT NULL
            AND ISJSON(j.JSON_stats) = 1
        ORDER BY j.ord
        FOR JSON PATH, INCLUDE_NULL_VALUES
    ) AS datasetsMetadata
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `;

  log.info('executing query with parameters', {
    queryLength: query.length,
    shortNamesParam: shortNamesJson,
  });

  const [queryErr, result] = await directQuery(
    query,
    {
      input: (request) => {
        request.input('shortNamesParam', sql.NVarChar, shortNamesJson);
      },
      description: 'bulk-download-init metadata query',
    },
    log,
  );

  if (queryErr) {
    log.error('database query failed', { error: queryErr });
    return {
      success: false,
      error: {
        statusCode: 500,
        message: 'Failed to fetch dataset metadata',
      },
    };
  }

  log.info('database query succeeded', {
    firstRecord:
      result && result.recordset && result.recordset.length > 0
        ? result.recordset[0]
        : null,
  });

  try {
    if (result.recordset && result.recordset.length > 0) {
      const firstRecord = result.recordset[0];
      const keys = Object.keys(firstRecord);

      if (keys.length > 0) {
        const parsedData = JSON.parse(firstRecord[keys[0]]);
        const datasetsMetadata = parsedData.datasetsMetadata || [];

        return {
          success: true,
          data: {
            datasetsMetadata,
          },
        };
      } else {
        return {
          success: true,
          data: {
            datasetsMetadata: [],
          },
        };
      }
    } else {
      log.warn('no records found in result', {
        hasRecordset: !!(result && result.recordset),
        recordsetLength:
          result && result.recordset ? result.recordset.length : 0,
      });

      return {
        success: true,
        data: {
          datasetsMetadata: [],
        },
      };
    }
  } catch (parseError) {
    log.error('failed to parse database result', { error: parseError, result });
    return {
      success: false,
      error: {
        statusCode: 500,
        message: 'Failed to process dataset metadata',
      },
    };
  }
};

module.exports = {
  createDatasetDirectory,
  fetchAndWriteMetadata,
  fetchTableNames,
  fetchAndWriteAllTables,
  parseFiltersToConstraints,
  fetchDatasetsMetadata,
};
