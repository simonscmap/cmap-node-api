const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');
const { getDatasetType } = require('../../utility/datasetType');
const fetchRowCountForQuery = require('../data/fetchRowCountForQuery');
const { parseFiltersToConstraints } = require('../data/bulk-download/dataFetchHelpers');
const { fetchTableNames } = require('../data/bulk-download/dataFetchHelpers');
const { fetchAndPrepareDatasetMetadata } = require('../catalog');
const { fetchDatasetLocationsWithCache } = require('../../utility/router/queries');

const log = initializeLogger('controllers/collections/calculateRowCounts');

// Tunable retry parameters
const MAX_RETRIES = parseInt(process.env.MAX_ROW_COUNT_RETRIES, 10) || 3;
const RETRY_DELAY = parseInt(process.env.ROW_COUNT_RETRY_DELAY, 10) || 1000; // milliseconds

// Timeout for individual dataset row count calculation (default: 90 seconds)
const DATASET_CALCULATION_TIMEOUT = parseInt(process.env.DATASET_ROW_COUNT_TIMEOUT, 10) || 300000;

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} errorMessage - Error message if timeout occurs
 * @returns {Promise} - Resolves with promise result or rejects with timeout error
 */
const withTimeout = (promise, ms, errorMessage) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

/**
 * Calculate row count for a single dataset with retry logic
 * @param {string} shortName - Dataset short name
 * @param {Object} constraints - Query constraints
 * @param {Object} metadata - Dataset metadata
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<{success: boolean, rowCount?: number, error?: string}>}
 */
const calculateDatasetRowCount = async (shortName, constraints, metadata, requestId) => {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Get table names from database
      const tableNames = await fetchTableNames(shortName, log);
      if (tableNames.length === 0) {
        log.warn('no tables found for dataset', { shortName });
        return { success: true, rowCount: 0 };
      }

      // Process all tables for this dataset concurrently
      const tablePromises = tableNames.map(async (tableName) => {
        log.debug('executing count query', { shortName, tableName, attempt });

        const [queryErr, count] = await fetchRowCountForQuery(
          tableName,
          constraints,
          metadata,
          requestId,
        );

        if (queryErr) {
          log.error('query execution failed', {
            shortName,
            tableName,
            attempt,
            error: queryErr,
          });
          throw new Error(
            `Query failed for dataset ${shortName}: ${
              queryErr.message || queryErr
            }`,
          );
        }

        const parsedCount = parseInt(count, 10) || 0;
        log.debug('table row count result', {
          shortName,
          tableName,
          count: parsedCount,
        });
        return parsedCount;
      });

      // Wait for all table counts for this dataset
      const tableCounts = await Promise.all(tablePromises);
      const totalRowCount = tableCounts.reduce(
        (sum, count) => sum + count,
        0,
      );

      log.info('dataset row count calculated', { shortName, totalRowCount, attempt });
      return { success: true, rowCount: totalRowCount };
    } catch (error) {
      lastError = error;
      log.warn('row count calculation attempt failed', {
        shortName,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        error: error.message,
      });

      // If this is not the last attempt, wait before retrying
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY);
      }
    }
  }

  // All retries exhausted
  log.error('all retry attempts exhausted for dataset', {
    shortName,
    attempts: MAX_RETRIES + 1,
    error: lastError.message,
  });

  return { success: false, error: lastError.message };
};

/**
 * Fetch dataset metadata including makes and sensors to determine type
 */
const fetchDatasetMetadataWithType = async (shortNames) => {
  const pool = await pools.userReadAndWritePool;
  const request = new sql.Request(pool);

  // Create a VALUES clause with all requested dataset names
  const valuesClause = shortNames
    .map((_, index) => {
      request.input('shortName' + index, sql.NVarChar, shortNames[index]);
      return `(@shortName${index})`;
    })
    .join(', ');

  const query = `
    WITH RequestedDatasets AS (
      SELECT shortName
      FROM (VALUES ${valuesClause}) AS v(shortName)
    )
    SELECT
      requested.shortName as shortName,
      ds.ID as datasetId,
      STRING_AGG(CAST(s.Sensor AS NVARCHAR(MAX)), ',') as sensors,
      STRING_AGG(CAST(m.Make AS NVARCHAR(MAX)), ',') as makes
    FROM RequestedDatasets requested
    LEFT JOIN tblDatasets ds ON requested.shortName = ds.Dataset_Name
    LEFT JOIN tblVariables v ON ds.ID = v.Dataset_ID
    LEFT JOIN tblSensors s ON v.Sensor_ID = s.ID
    LEFT JOIN tblMakes m ON v.Make_ID = m.ID
    GROUP BY requested.shortName, ds.ID
  `;

  const result = await request.query(query);

  // Process results to deduplicate and determine type
  return result.recordset.map((row) => {
    const deduplicateList = (str) => {
      if (!str) {
        return [];
      }
      const items = str
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item);
      return Array.from(new Set(items));
    };

    const sensors = deduplicateList(row.sensors);
    const makes = deduplicateList(row.makes);
    const type = getDatasetType(makes, sensors);

    return {
      shortName: row.shortName,
      datasetId: row.datasetId,
      type: type,
      sensors: sensors,
      makes: makes,
    };
  });
};

module.exports = async (req, res) => {
  const { shortNames, constraints } = req.body;

  // Validate request
  if (!Array.isArray(shortNames) || shortNames.length === 0) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'shortNames must be a non-empty array',
    });
  }

  if (!constraints || typeof constraints !== 'object') {
    return res.status(400).json({
      error: 'validation_error',
      message: 'constraints must be an object',
    });
  }

  const requestId = `row-count-${Date.now()}`;

  log.info('calculate row counts request received', {
    datasetCount: shortNames.length,
    datasetsRequested: shortNames,
    constraints,
  });

  try {
    // Fetch dataset metadata with types
    const datasetsInfo = await fetchDatasetMetadataWithType(shortNames);

    log.info('fetched dataset types', {
      datasetsInfo: datasetsInfo.map((d) => ({
        shortName: d.shortName,
        type: d.type,
        makes: d.makes,
        sensors: d.sensors,
      })),
    });

    // Fetch dataset locations to detect cluster-only datasets
    // fetchDatasetLocationsWithCache returns [Error?, Map]
    const [locationsErr, datasetLocations] = await fetchDatasetLocationsWithCache();

    if (locationsErr || !datasetLocations) {
      log.error('failed to fetch dataset locations', {
        error: locationsErr,
      });
      // Continue without cluster-only detection if fetch fails
    } else {
      log.debug('fetched dataset locations', {
        locationsMapSize: datasetLocations.size,
      });
    }

    // Separate datasets by type
    const datasetsToCalculate = [];
    const datasetsToSkip = [];

    for (const info of datasetsInfo) {
      // Check if dataset is cluster-only (only if location data was successfully fetched)
      let isClusterOnly = false;
      if (!locationsErr && datasetLocations && info.datasetId) {
        const locations = datasetLocations.get(info.datasetId);
        isClusterOnly = locations &&
                        locations.length === 1 &&
                        locations[0] === 'cluster';

        if (isClusterOnly) {
          log.info('skipping cluster-only dataset', {
            shortName: info.shortName,
            datasetId: info.datasetId,
            locations: locations,
          });
        }
      }

      if (isClusterOnly) {
        datasetsToSkip.push(info.shortName);
      } else {
        datasetsToCalculate.push(info.shortName);
        log.info('including dataset for calculation', {
          shortName: info.shortName,
          type: info.type,
          makes: info.makes,
          sensors: info.sensors,
        });
      }
    }

    // Parse constraints to the format expected by fetchRowCountForQuery
    const parsedConstraints = parseFiltersToConstraints(constraints);

    // Calculate row counts for eligible datasets
    const calculationPromises = datasetsToCalculate.map(async (shortName) => {
      // Fetch full metadata for calculation
      const [metadataErr, metadata] = await fetchAndPrepareDatasetMetadata(
        shortName,
        requestId,
      );

      if (metadataErr) {
        log.error('failed to fetch metadata for dataset', {
          shortName,
          error: metadataErr,
        });
        return {
          shortName,
          success: false,
          error: 'Failed to fetch metadata',
        };
      }

      // Wrap the calculation in a timeout
      try {
        const result = await withTimeout(
          calculateDatasetRowCount(
            shortName,
            parsedConstraints,
            metadata,
            requestId,
          ),
          DATASET_CALCULATION_TIMEOUT,
          `Row count calculation timed out after ${DATASET_CALCULATION_TIMEOUT}ms`,
        );

        return {
          shortName,
          ...result,
        };
      } catch (timeoutError) {
        log.error('dataset row count calculation timed out', {
          shortName,
          timeout: DATASET_CALCULATION_TIMEOUT,
          error: timeoutError.message,
        });
        return {
          shortName,
          success: false,
          error: timeoutError.message,
        };
      }
    });

    // Wait for all calculations to complete
    const calculationResults = await Promise.all(calculationPromises);

    // Organize results
    const results = {};
    const failed = [];

    for (const result of calculationResults) {
      if (result.success) {
        results[result.shortName] = result.rowCount;
      } else {
        failed.push(result.shortName);
      }
    }

    const response = {
      results,
      skipped: datasetsToSkip,
      failed,
      metadata: {
        totalCalculated: Object.keys(results).length,
        totalSkipped: datasetsToSkip.length,
        totalFailed: failed.length,
      },
    };

    log.info('row count calculation completed', {
      totalDatasets: shortNames.length,
      calculated: response.metadata.totalCalculated,
      skipped: response.metadata.totalSkipped,
      failed: response.metadata.totalFailed,
    });

    res.status(200).json(response);
  } catch (error) {
    log.error('error calculating row counts', {
      error: error.message,
      datasetsRequested: shortNames,
    });
    res.status(500).json({
      error: 'server_error',
      message: 'Error calculating row counts',
    });
  }
};
