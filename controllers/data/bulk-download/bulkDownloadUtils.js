const safePromise = require('../../../utility/safePromise');
const { createTempDir, cleanup } = require('./tempDirUtils');
const streamArchive = require('./streamArchive');
const { fetchAndWriteData } = require('./fetchAndWriteData');

// Batch operation to fetch all datasets
const fetchAllDatasetFiles = async (
  dirTarget,
  shortNames,
  reqId,
  datasetsMetadata = null,
  constraints = null,
) => {
  try {
    const result = await Promise.all(
      shortNames.map((shortName) => {
        // Extract the specific metadata for this dataset
        let metadata = null;
        if (Array.isArray(datasetsMetadata)) {
          const found = datasetsMetadata.find(
            (item) => item.shortName === shortName,
          );
          metadata = found ? found.metadata : null;
        } else {
          metadata = datasetsMetadata;
        }

        return fetchAndWriteData(
          dirTarget,
          shortName,
          reqId,
          metadata,
          constraints,
        );
      }),
    );
    return [null, result];
  } catch (error) {
    return [error];
  }
};

const createWorkspace = async (log) => {
  try {
    const pathToTmpDir = await createTempDir();
    log.debug('created temporary directory', pathToTmpDir);
    return { success: true, pathToTmpDir };
  } catch (error) {
    log.error('error creating directory', { error });
    return { success: false, error: 'error creating temp directory' };
  }
};

const fetchAllDatasets = async (
  pathToTmpDir,
  shortNames,
  reqId,
  log,
  datasetsMetadata = null,
  constraints = null,
) => {
  log.debug('shortNames', shortNames);

  const [dataErr, result] = await fetchAllDatasetFiles(
    pathToTmpDir,
    shortNames,
    reqId,
    datasetsMetadata,
    constraints,
  );

  if (dataErr) {
    log.error('fetchAndWriteDataErr', dataErr);

    if (dataErr.message === 'could not find dataset id for dataset name') {
      return {
        success: false,
        error: { statusCode: 400, message: 'no matching dataset' },
      };
    } else if (dataErr.statusCode === 413) {
      // Preserve size-related errors (413 Payload Too Large)
      log.info('returning size-related error to client', { 
        statusCode: dataErr.statusCode, 
        message: dataErr.message 
      });
      return {
        success: false,
        error: { statusCode: dataErr.statusCode, message: dataErr.message },
      };
    } else {
      return {
        success: false,
        error: { statusCode: 500, message: 'error fetching data' },
      };
    }
  }

  return { success: true, result };
};

const streamResponse = async (pathToTmpDir, res, log) => {
  const safeStreamArchive = safePromise(streamArchive);
  log.info('starting stream response');

  const [streamError, streamResolve] = await safeStreamArchive(
    pathToTmpDir,
    res,
  );

  if (streamError) {
    log.error('error streaming archive response');
    return {
      success: false,
      error: { statusCode: 500, message: 'error streaming archive' },
    };
  } else {
    log.debug('streamArchive resolved without error', { streamResolve });
    return { success: true };
  }
};

const scheduleCleanup = async (pathToTmpDir, moduleLogger) => {
  const msg = await cleanup(pathToTmpDir);
  moduleLogger.info('cleanup', { msg });
};

const sendValidationError = (res, next, validation) => {
  res.status(validation.statusCode).send(validation.message);
  return next('validation failed');
};

const sendWorkspaceError = (res, next) => {
  res.sendStatus(500);
  return next('error creating temp directory');
};

const sendFetchError = (res, next, error) => {
  res.status(error.statusCode).send(error.message);
  const nextMessage =
    error.statusCode === 400
      ? 'error finding dataset id'
      : 'error fetching data for bulk download';
  return next(nextMessage);
};

const sendStreamError = (res, next) => {
  res.status(500).send('error streaming archive');
  return next('error streaming archive for bulk download');
};

const validateShortNames = (shortNames, log) => {
  if (!shortNames || !Array.isArray(shortNames) || shortNames.length === 0) {
    log.error('invalid request: shortNames must be a non-empty array', { shortNames });
    return {
      isValid: false,
      error: {
        statusCode: 400,
        message: 'shortNames must be a non-empty array'
      }
    };
  }

  if (shortNames.some(name => typeof name !== 'string' || name.trim() === '')) {
    log.error('invalid request: all shortNames must be non-empty strings', { shortNames });
    return {
      isValid: false,
      error: {
        statusCode: 400,
        message: 'All shortNames must be non-empty strings'
      }
    };
  }

  return { isValid: true };
};

module.exports = {
  createWorkspace,
  fetchAllDatasets,
  streamResponse,
  scheduleCleanup,
  sendValidationError,
  sendWorkspaceError,
  sendFetchError,
  sendStreamError,
  validateShortNames,
};
