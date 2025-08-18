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
const { validateRequest } = require('./requestValidation');



/*
   1. validate incoming request
   2. create a guid-name temp directory
   3. fetch and write data for each requested dataset (csv + excel metadata sheet)
   4. (once all data is fetched) create zip and pipe response
   5. initate clean-up of temp directory
 */

const bulkDownloadController = async (req, res, next) => {
  const log = moduleLogger.setReqId(req.reqId);

  // 1. Validate incoming request
  const validation = validateRequest(req, log);
  if (!validation.isValid) {
    return sendValidationError(res, next, validation);
  }
  const { shortNames, filters } = validation;

  // 2. Create workspace directory
  const workspaceResult = await createWorkspace(log);
  if (!workspaceResult.success) {
    return sendWorkspaceError(res, next);
  }
  const { pathToTmpDir } = workspaceResult;

  // 3. Fetch and write data for each requested dataset
  const fetchResult = await fetchAllDatasets(pathToTmpDir, shortNames, req.reqId, log, filters);
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

module.exports = {
  bulkDownloadController,
};
