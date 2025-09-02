const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');
const {
  createWorkspace,
  fetchAllDatasets,
  streamResponse,
  scheduleCleanup,
  sendValidationError,
  sendWorkspaceError,
  sendFetchError,
  sendStreamError,
} = require('./bulkDownloadUtils');
const fetchRowCountForQuery = require('../fetchRowCountForQuery');
const { processPreQueryLogic } = require('./sharedPreQueryProcessor');
const { fetchTableNames } = require('./dataFetchHelpers');
const directQuery = require('../../../utility/directQuery');
const sql = require('mssql');

const bulkDownloadController = async (req, res, next) => {
  const log = moduleLogger.setReqId(req.reqId);

  // 1. Use shared pre-query processing for validation only
  const preQueryResult = await processPreQueryLogic(req, req.reqId);
  if (!preQueryResult.success) {
    return sendValidationError(res, next, preQueryResult.validation);
  }

  // Extract shortNames, constraints, original filters, and datasetsMetadata from validation
  const { shortNames, constraints, datasetsMetadata } = preQueryResult;

  // 2. Create workspace directory
  const workspaceResult = await createWorkspace(log);
  if (!workspaceResult.success) {
    return sendWorkspaceError(res, next);
  }
  const { pathToTmpDir } = workspaceResult;

  // 3. Fetch and write data using existing function
  const fetchResult = await fetchAllDatasets(
    pathToTmpDir,
    shortNames,
    req.reqId,
    log,
    datasetsMetadata,
    constraints,
  );
  if (!fetchResult.success) {
    return sendFetchError(res, next, fetchResult.error);
  }

  // 4. Create zip and pipe response
  const streamResult = await streamResponse(pathToTmpDir, res, log);
  if (!streamResult.success) {
    return sendStreamError(res, next);
  }

  // 5. Schedule cleanup of temp directory
  scheduleCleanup(pathToTmpDir, moduleLogger);
  next();
};

const bulkRowCountController = async (req, res) => {
  const requestId = 'bulk-row-count';
  const log = moduleLogger.setReqId(requestId);

  log.info('bulk row count request received', { body: req.body });

  try {
    // Use shared pre-query processing
    const preQueryResult = await processPreQueryLogic(req, requestId);
    if (!preQueryResult.success) {
      log.error('request validation failed', {
        validation: preQueryResult.validation,
      });
      return res.status(preQueryResult.validation.statusCode).json({
        error: 'Failed to calculate row counts',
        message: preQueryResult.validation.message,
      });
    }

    const { constraints, datasetsMetadata } = preQueryResult;

    // Continue with controller-specific logic (query execution and counting)
    const datasetPromises = datasetsMetadata.map(
      async ({ shortName, metadata }) => {
        log.info('processing dataset for row count', { shortName });

        // Get table names from database
        const tableNames = await fetchTableNames(shortName, log);
        if (tableNames.length === 0) {
          log.warn('no tables found for dataset', { shortName });
          return { shortName, rowCount: 0 };
        }

        // Process all tables for this dataset concurrently
        const tablePromises = tableNames.map(async (tableName) => {
          log.debug('executing count query', { shortName, tableName });

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

        log.info('dataset row count calculated', { shortName, totalRowCount });
        return { shortName, rowCount: totalRowCount };
      },
    );

    // Wait for all datasets to complete (all-or-nothing)
    const datasetResults = await Promise.all(datasetPromises);

    // Transform results to simple response format
    const response = {};
    datasetResults.forEach(({ shortName, rowCount }) => {
      response[shortName] = rowCount;
    });

    log.info('bulk row count calculation completed', { response });
    res.json(response);
  } catch (error) {
    log.error('bulk row count calculation failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to calculate row counts',
      message: error.message,
    });
  }
};

const bulkDownloadInitController = async (req, res) => {
  const requestId = 'bulk-download-init';
  const log = moduleLogger.setReqId(requestId);

  log.info('bulk download init request received', { body: req.body });

  try {
    // Input validation
    const { shortNames } = req.body;
    
    if (!shortNames || !Array.isArray(shortNames) || shortNames.length === 0) {
      log.error('invalid request: shortNames must be a non-empty array', { shortNames });
      return res.status(400).json({
        error: 'Invalid request',
        message: 'shortNames must be a non-empty array'
      });
    }

    if (shortNames.some(name => typeof name !== 'string' || name.trim() === '')) {
      log.error('invalid request: all shortNames must be non-empty strings', { shortNames });
      return res.status(400).json({
        error: 'Invalid request',
        message: 'All shortNames must be non-empty strings'
      });
    }

    // Prepare SQL query using OPENJSON approach
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

    // Execute query with parameters
    const [queryErr, result] = await directQuery(query, {
      input: (request) => {
        request.input('shortNamesParam', sql.NVarChar, JSON.stringify(shortNames));
      },
      description: 'bulk-download-init metadata query'
    }, log);

    if (queryErr) {
      log.error('database query failed', { error: queryErr });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch dataset metadata'
      });
    }

    // Parse the JSON response
    let response;
    try {
      if (result.recordset && result.recordset.length > 0 && result.recordset[0].datasetsMetadata) {
        const parsedData = JSON.parse(result.recordset[0].datasetsMetadata);
        response = {
          datasetsMetadata: parsedData || []
        };
      } else {
        response = {
          datasetsMetadata: []
        };
      }
    } catch (parseError) {
      log.error('failed to parse database result', { error: parseError, result });
      return res.status(500).json({
        error: 'Data processing error',
        message: 'Failed to process dataset metadata'
      });
    }

    log.info('bulk download init completed', { 
      requestedCount: shortNames.length, 
      returnedCount: response.datasetsMetadata.length 
    });
    
    res.json(response);

  } catch (error) {
    log.error('bulk download init failed', { error: error.message });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to initialize bulk download'
    });
  }
};

module.exports = {
  bulkDownloadController,
  bulkRowCountController,
  bulkDownloadInitController,
};
