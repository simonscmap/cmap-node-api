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
  validateShortNames,
  incrementCollectionDownloads,
} = require('./bulkDownloadUtils');
const { processPreQueryLogic } = require('./sharedPreQueryProcessor');
const { fetchDatasetsMetadata } = require('./dataFetchHelpers');
const { writeBreadcrumb, removeBreadcrumb } = require('./breadcrumb');

const bulkDownloadController = async (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);

  // 1. Use shared pre-query processing for validation only
  const preQueryResult = await processPreQueryLogic(req, req.requestId);
  if (!preQueryResult.success) {
    return sendValidationError(res, next, preQueryResult.validation);
  }

  // Extract shortNames, constraints, original filters, datasetsMetadata, and collectionId from validation
  const { shortNames, constraints, datasetsMetadata, collectionId } = preQueryResult;

  let mem = process.memoryUsage();
  log.info('bulk-download memory at start', {
    rssMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    datasetCount: shortNames.length,
    datasets: shortNames,
  });

  writeBreadcrumb(req.requestId, shortNames);

  const workspaceResult = await createWorkspace(log);
  if (!workspaceResult.success) {
    return sendWorkspaceError(res, next);
  }
  const { pathToTmpDir } = workspaceResult;

  try {
    const fetchResult = await fetchAllDatasets(
      pathToTmpDir,
      shortNames,
      req.requestId,
      log,
      datasetsMetadata,
      constraints,
    );
    if (!fetchResult.success) {
      return sendFetchError(res, next, fetchResult.error);
    }

    const streamResult = await streamResponse(pathToTmpDir, res, req, log);
    if (!streamResult.success) {
      return sendStreamError(res, next);
    }

    if (collectionId) {
      incrementCollectionDownloads(collectionId, log);
    }

    next();
  } finally {
    let memAfter = process.memoryUsage();
    log.info('bulk-download memory at end', {
      rssMB: Math.round(memAfter.rss / 1024 / 1024),
      heapUsedMB: Math.round(memAfter.heapUsed / 1024 / 1024),
    });

    removeBreadcrumb(req.requestId);

    try {
      await scheduleCleanup(pathToTmpDir, moduleLogger);
    } catch (cleanupErr) {
      log.error('cleanup failed in finally block', { error: cleanupErr, pathToTmpDir });
    }
  }
};

const bulkDownloadInitController = async (req, res) => {
  const requestId = 'bulk-download-init';
  const log = moduleLogger.setReqId(requestId);

  log.info('bulk download init request received', { body: req.body });

  try {
    // Input validation using helper function
    const { shortNames } = req.body;
    const validationResult = validateShortNames(shortNames, log);
    
    if (!validationResult.isValid) {
      return res.status(validationResult.error.statusCode).json({
        error: 'Invalid request',
        message: validationResult.error.message
      });
    }

    // Fetch datasets metadata using helper function
    const metadataResult = await fetchDatasetsMetadata(shortNames, log);
    
    if (!metadataResult.success) {
      return res.status(metadataResult.error.statusCode).json({
        error: 'Database error',
        message: metadataResult.error.message
      });
    }

    log.info('bulk download init completed', { 
      requestedCount: shortNames.length, 
      returnedCount: metadataResult.data.datasetsMetadata.length 
    });
    
    res.json(metadataResult.data);

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
  bulkDownloadInitController,
};
