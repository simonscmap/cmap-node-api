let os = require('os');
let path = require('path');
let fs = require('fs');
let initLog = require('../../../log-service');
let { TMP_DIR_PREFIX } = require('../../../utility/constants');

let log = initLog('bulk-download-reaper');
let tmpBase = os.tmpdir();

let reapStaleTempDirs = (maxAgeMs) => {
  try {
    let entries = fs.readdirSync(tmpBase);
    let now = Date.now();
    let reaped = 0;

    entries.forEach((entry) => {
      if (!entry.startsWith(TMP_DIR_PREFIX)) {
        return;
      }

      let fullPath = path.join(tmpBase, entry);
      try {
        let stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) {
          return;
        }

        let ageMs = now - stat.mtimeMs;
        if (ageMs > maxAgeMs) {
          fs.rmdirSync(fullPath, { recursive: true });
          reaped++;
          log.info('reaped stale temp dir', {
            path: fullPath,
            ageMinutes: Math.round(ageMs / 60000),
          });
        }
      } catch (e) {
        log.warn('failed to stat or remove temp dir', {
          path: fullPath,
          error: e.message,
        });
      }
    });

    if (reaped > 0) {
      log.info('reaper sweep complete', { reaped });
    }
  } catch (e) {
    log.warn('reaper sweep failed', { error: e.message });
  }
};

let startBulkDownloadTempDirReaper = (maxAgeMs, intervalMs) => {
  log.info('starting temp dir reaper', {
    maxAgeMinutes: Math.round(maxAgeMs / 60000),
    intervalMinutes: Math.round(intervalMs / 60000),
  });

  reapStaleTempDirs(maxAgeMs);

  return setInterval(() => reapStaleTempDirs(maxAgeMs), intervalMs);
};

module.exports = { startBulkDownloadTempDirReaper, reapStaleTempDirs };
