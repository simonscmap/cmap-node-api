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

// Validation function
const validateRequest = (req, log) => {
  if (!req.body.shortNames) {
    log.error('missing argument', { body: req.body });
    return {
      isValid: false,
      statusCode: 400,
      message: 'bad request: missing argument',
    };
  }

  let shortNames;
  try {
    shortNames = JSON.parse(req.body.shortNames);
  } catch (e) {
    log.error('error parsing post body', { error: e, body: req.body });
    return {
      isValid: false,
      statusCode: 400,
      message: 'bad request: invalid json',
    };
  }

  if (!Array.isArray(shortNames) || shortNames.length === 0) {
    log.error('incorrect argument type: expected non-empty array of strings');
    return {
      isValid: false,
      statusCode: 400,
      message: 'bad request: incorrect argument type',
    };
  }

  return { isValid: true, shortNames };
};

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
  const { shortNames } = validation;

  // 2. Create workspace directory
  const workspaceResult = await createWorkspace(log);
  if (!workspaceResult.success) {
    return sendWorkspaceError(res, next);
  }
  const { pathToTmpDir } = workspaceResult;

  // 3. Fetch and write data for each requested dataset
  const fetchResult = await fetchAllDatasets(pathToTmpDir, shortNames, req.reqId, log);
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
