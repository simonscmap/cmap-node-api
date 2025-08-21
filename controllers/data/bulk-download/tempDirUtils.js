const os = require('os');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
const util = require('util');
const initLog = require('../../../log-service');
const { TMP_DIR_PREFIX } = require('../../../utility/constants');

const moduleLogger = initLog('bulk-download');
const exec = util.promisify(child_process.exec);
const tempDirTemplate = path.join(os.tmpdir(), TMP_DIR_PREFIX);

// createTempDir :: () -> Promise<path>
// make and return the name of a temporary directory
const createTempDir = () => {
  return fs.promises.mkdtemp(tempDirTemplate);
};

// validate that the temp dir path is in the os's temp dir,
// and named in the expected format
const validateTempDirPath = (p) => {
  return typeof p === 'string' && p.indexOf(tempDirTemplate) === 0;
};

const createSubDir = (tempDir, shortName) => {
  return fs.promises.mkdir(path.join(tempDir, shortName));
};

// cleanup :: () -> Promise<msg>
// remove directory at provided path
const cleanup = async (pathToTmpDir, reqId) => {
  const log = moduleLogger.setReqId(reqId);
  log.debug('cleanup path', { pathToTmpDir });
  const isValid = validateTempDirPath(pathToTmpDir);
  if (!isValid) {
    return Promise.reject(
      'path provided for deletion does not match template; ' +
        'refusing to perform directory deletion',
    );
  }

  if (pathToTmpDir) {
    try {
      const { stdout, stderr } = await exec(`rm -rf ${pathToTmpDir}`);
      return Promise.resolve(`cleanup complete ${stdout}${stderr}`.trim());
    } catch (e) {
      log.error('error cleaning up temp dir', { pathToTmpDir: path, error: e });
      return Promise.reject(e);
    }
  }
};

module.exports = {
  createTempDir,
  validateTempDirPath,
  createSubDir,
  cleanup,
};