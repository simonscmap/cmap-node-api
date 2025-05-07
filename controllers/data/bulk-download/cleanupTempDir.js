const path = require('path');
const child_process = require('child_process');
const util = require('util');
const { validateTempDirPath } = require('./createTempDir');
const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');

const exec = util.promisify(child_process.exec);

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

module.exports = cleanup;
