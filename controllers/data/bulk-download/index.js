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

const bulkDownloadController = async (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);

  // 1. Use shared pre-query processing for validation only
  const preQueryResult = await processPreQueryLogic(req, req.requestId);
  if (!preQueryResult.success) {
    return sendValidationError(res, next, preQueryResult.validation);
  }

  // Extract shortNames, constraints, original filters, datasetsMetadata, and collectionId from validation
  const { shortNames, constraints, datasetsMetadata, collectionId } = preQueryResult;

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
    req.requestId,
    log,
    datasetsMetadata,
    constraints,
  );
  if (!fetchResult.success) {
    scheduleCleanup(pathToTmpDir, moduleLogger);
    return sendFetchError(res, next, fetchResult.error);
  }

  // 4. Create zip and pipe response
  const streamResult = await streamResponse(pathToTmpDir, res, log);
  if (!streamResult.success) {
    scheduleCleanup(pathToTmpDir, moduleLogger);
    return sendStreamError(res, next);
  }

  // 5. Increment downloads count if collection_id is provided
  if (collectionId) {
    incrementCollectionDownloads(collectionId, log);
  }

  // 6. Schedule cleanup of temp directory
  scheduleCleanup(pathToTmpDir, moduleLogger);
  next();
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
