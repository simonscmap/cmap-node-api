const os = require("os");
const path = require("path");
const fs = require("fs");

const { TMP_DIR_PREFIX } = require("../../../utility/constants");

const tempDirTemplate = path.join(os.tmpdir(), TMP_DIR_PREFIX);


// createTempDir :: () -> Promise<path>
// make and return the name of a temporary directory
const createTempDir = () => {
  return fs.promises.mkdtemp(tempDirTemplate)
}

// validate that the temp dir path is in the os's temp dir,
// and named in the expected format
const validateTempDirPath = (p) => {
  return typeof p === 'string'
      && p.indexOf(tempDirTemplate) === 0;
}

const createSubDir = (tempDir, shortName) => {
  return fs.promises.mkdir (path.join(tempDir, shortName));
}

module.exports = {
  createTempDir,
  validateTempDirPath,
  createSubDir,
};
