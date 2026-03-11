const archiver = require('archiver');
const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');
const path = require('path');

const streamArchive = (pathToTmpDir, res, req) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let archiveFinalized = false;
    const safeResolve = (val) => { if (!settled) { settled = true; resolve(val); } };
    const safeReject = (err) => { if (!settled) { settled = true; reject(err); } };

    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    const isTest = res.locals.test;

    archive.on('end', () => {
      archiveFinalized = true;
    });

    res.on('close', () => {
      if (archiveFinalized) {
        moduleLogger.info('response stream closed', { bytes: archive.pointer() });
        safeResolve({ bytes: archive.pointer() });
      } else {
        moduleLogger.warn('client disconnected before archive complete', {
          bytes: archive.pointer(),
        });
        archive.destroy();
        safeReject(new Error('client disconnected'));
      }
    });

    res.on('error', (err) => {
      moduleLogger.error('response stream error', { error: err });
      archive.destroy();
      safeReject(err);
    });

    req.on('aborted', () => {
      moduleLogger.warn('request aborted by client');
      archive.destroy();
      safeReject(new Error('request aborted'));
    });

    archive.on('warning', (err) => {
      moduleLogger.error('error in archiving stream', { error: err });
      if (err.code !== 'ENOENT') {
        safeReject(err);
      }
    });

    archive.on('error', (err) => {
      moduleLogger.error('error streaming archive', { error: err });
      safeReject(err);
    });

    let lastMemLog = 0;
    let memLogInterval = 30000;
    archive.on('data', () => {
      let now = Date.now();
      if (now - lastMemLog > memLogInterval) {
        lastMemLog = now;
        let mem = process.memoryUsage();
        moduleLogger.info('bulk-download memory during stream', {
          rssMB: Math.round(mem.rss / 1024 / 1024),
          heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
          archiveBytes: archive.pointer(),
        });
      }
    });

    res.set('X-Accel-Buffering', 'no');
    archive.pipe(res);

    moduleLogger.info('archiving dir', pathToTmpDir);

    const options = {
      name: path.join(pathToTmpDir, 'CMAP-Bulk-Download'),
    };

    if (isTest) {
      options.date = new Date(0);
    }

    archive.directory(pathToTmpDir, 'CMAP-Bulk-Download', options);

    archive.finalize();
  });

module.exports = streamArchive;
