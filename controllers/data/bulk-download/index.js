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
const generateQueryFromConstraints = require('../generateQueryFromConstraints');
const { internalRouter } = require('../../../utility/router/internal-router');
const { processPreQueryLogic } = require('./sharedPreQueryProcessor');

/*
   1. validate incoming request
   2. create a guid-name temp directory
   3. fetch and write data for each requested dataset (csv + excel metadata sheet)
   4. (once all data is fetched) create zip and pipe response
   5. initate clean-up of temp directory
 */

const bulkDownloadController = async (req, res, next) => {
  const log = moduleLogger.setReqId(req.reqId);

  // 1. Use shared pre-query processing for validation only
  const preQueryResult = await processPreQueryLogic(req, req.reqId);
  if (!preQueryResult.success) {
    return sendValidationError(res, next, preQueryResult.validation);
  }

  // Extract shortNames and original filters from validation
  const { shortNames } = preQueryResult;
  const { filters } = preQueryResult.validation;

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
    filters,
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

    const { constraints, datasets } = preQueryResult;

    // Continue with controller-specific logic (query execution and counting)
    const datasetPromises = datasets.map(async ({ shortName, metadata }) => {
      log.info('processing dataset for row count', { shortName });

      // Get table names from metadata
      const tableNames = metadata.tables || [];
      if (tableNames.length === 0) {
        log.warn('no tables found for dataset', { shortName });
        return { shortName, rowCount: 0 };
      }

      // Process all tables for this dataset concurrently
      const tablePromises = tableNames.map(async (tableName) => {
        const query = generateQueryFromConstraints(
          tableName,
          constraints,
          metadata,
          'count',
        );

        log.debug('executing count query', { shortName, tableName, query });

        const [queryErr, result] = await internalRouter(query, requestId);
        if (queryErr) {
          log.error('query execution failed', {
            shortName,
            tableName,
            query,
            error: queryErr,
          });
          throw new Error(
            `Query failed for dataset ${shortName}: ${queryErr.message}`,
          );
        }

        // Extract count
        const count =
          result && result[0] && result[0].c ? parseInt(result[0].c, 10) : 0;
        log.debug('table row count result', { shortName, tableName, count });
        return count;
      });

      // Wait for all table counts for this dataset
      const tableCounts = await Promise.all(tablePromises);
      const totalRowCount = tableCounts.reduce((sum, count) => sum + count, 0);

      log.info('dataset row count calculated', { shortName, totalRowCount });
      return { shortName, rowCount: totalRowCount };
    });

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

module.exports = {
  bulkDownloadController,
  bulkRowCountController,
};
