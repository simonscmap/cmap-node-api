const archiver = require('archiver');
const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');
const path = require('path');

const streamArchive = (pathToTmpDir, res) =>
  new Promise((resolve, reject) => {
    /* Create Zip Archive */
    // options: https://www.archiverjs.com/docs/archiver
    const archive = archiver('zip', {
      zlib: { level: 9 }, // compression level
    });

    const isTest = res.locals.test;

    /* Event Handlers for destination stream */
    res.on('close', () => {
      moduleLogger.info('response stream closed', { bytes: archive.pointer() });
      moduleLogger.info(
        'archiver has been finalized and the output file descriptor has closed.',
        null,
      );
      return resolve({ bytes: archive.pointer() });
    });

    res.on('end', () => {
      moduleLogger.info('Data has been drained', null);
    });

    /* Event Handlers for source stream */
    archive.on('warning', (err) => {
      moduleLogger.error('error in archiving stream', { error: err });
      if (err.code !== 'ENOENT') {
        return reject(err);
      }
    });

    archive.on('error', (err) => {
      moduleLogger.error('error streaming archive', { error: err });
      reject(err);
    });

    /* Pipe Response */
    archive.pipe(res);

    //append files from a sub-directory and naming it `new-subdir` within the archive
    moduleLogger.info('archiving dir', pathToTmpDir);

    const options = {
      name: path.join(pathToTmpDir, 'CMAP-Bulk-Download'),
    };

    if (isTest) {
      options.date = new Date(0);
    }

    archive.directory(pathToTmpDir, 'CMAP-Bulk-Download', options);

    // end
    archive.finalize();
  });

module.exports = streamArchive;
