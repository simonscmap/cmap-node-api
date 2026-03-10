let fs = require('fs');
let path = require('path');
let initLog = require('../../../log-service');

let log = initLog('bulk-download-breadcrumb');

let BREADCRUMB_DIR = '/tmp';
let BREADCRUMB_PREFIX = 'bulk-download-breadcrumb-';

let getBreadcrumbPath = (requestId) => {
  return path.join(BREADCRUMB_DIR, BREADCRUMB_PREFIX + requestId + '.json');
};

let ensureBreadcrumbDir = () => {
  try {
    if (!fs.existsSync(BREADCRUMB_DIR)) {
      fs.mkdirSync(BREADCRUMB_DIR, { recursive: true });
    }
    return true;
  } catch (e) {
    log.warn('cannot create breadcrumb directory', { dir: BREADCRUMB_DIR, error: e.message });
    return false;
  }
};

let writeBreadcrumb = (requestId, shortNames) => {
  if (!ensureBreadcrumbDir()) {
    return null;
  }

  let mem = process.memoryUsage();
  let breadcrumbPath = getBreadcrumbPath(requestId);
  let data = {
    pid: process.pid,
    requestId: requestId,
    timestamp: new Date().toISOString(),
    rssMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    datasetCount: shortNames.length,
    datasets: shortNames.slice(0, 20),
  };

  try {
    fs.writeFileSync(breadcrumbPath, JSON.stringify(data, null, 2));
    return breadcrumbPath;
  } catch (e) {
    log.warn('failed to write breadcrumb', { path: breadcrumbPath, error: e.message });
    return null;
  }
};

let removeBreadcrumb = (requestId) => {
  let breadcrumbPath = getBreadcrumbPath(requestId);
  try {
    fs.unlinkSync(breadcrumbPath);
  } catch (e) {
    // breadcrumb may not exist if writeBreadcrumb failed or was never called
  }
};

let checkStaleBreadcrumbs = () => {
  try {
    if (!fs.existsSync(BREADCRUMB_DIR)) {
      return;
    }

    let files = fs.readdirSync(BREADCRUMB_DIR)
      .filter((f) => f.startsWith(BREADCRUMB_PREFIX));

    if (files.length === 0) {
      log.info('no stale breadcrumbs found');
      return;
    }

    log.warn('found stale bulk-download breadcrumbs from prior crash', {
      count: files.length,
    });

    files.forEach((f) => {
      let filePath = path.join(BREADCRUMB_DIR, f);
      try {
        let raw = fs.readFileSync(filePath, 'utf8');
        let data = JSON.parse(raw);
        log.warn('OOM evidence: bulk-download was in progress when server died', data);
        fs.unlinkSync(filePath);
      } catch (e) {
        log.warn('failed to read or clean stale breadcrumb', { file: f, error: e.message });
        try { fs.unlinkSync(filePath); } catch (ignored) {}
      }
    });
  } catch (e) {
    log.warn('failed to check for stale breadcrumbs', { error: e.message });
  }
};

module.exports = {
  writeBreadcrumb,
  removeBreadcrumb,
  checkStaleBreadcrumbs,
};
