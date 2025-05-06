const safePromise = require('../../../utility/safePromise');
const { createTempDir } = require('./createTempDir');
const cleanup = require('./cleanupTempDir');
const streamArchive = require('./streamArchive');
const fetchAndWriteData = require('./fetchAndWriteData');
const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');

/*
   1. validate incoming request
   2. create a guid-name temp directory
   3. fetch and write data for each requested dataset (csv + excel metadata sheet)
   4. (once all data is fetched) create zip and pipe response
   5. initate clean-up of temp directory
 */

const bulkDownloadController = async (req, res, next) => {
  const log = moduleLogger.setReqId(req.reqId);

  // 1. TODO validate incoming request
  if (!req.body.shortNames) {
    log.error('missing argument', { body: req.body });
    res.status(400).send('bad request: missing argument');
    return next('missing argument');
  }

  let shortNames;
  try {
    shortNames = JSON.parse(req.body.shortNames);
  } catch (e) {
    log.error('error parsing post body', { error: e, body: req.body });
    res.status(400).send('bad request: invalid json');
    return next('error parsing post body');
  }
  if (!Array.isArray(shortNames) || shortNames.length === 0) {
    log.error('incorrect argument type: expected non-empty array of strings');
    res.status(400).send('bad request: incorrect argument type');
    return next('insufficient argument');
  }

  log.debug('shortNames', shortNames);

  // 2. create a guid-name temp directory
  // TODO make call to createTempDir safe
  let pathToTmpDir;
  try {
    pathToTmpDir = await createTempDir();
  } catch (e) {
    log.error('error creating directory', { error: e });
    res.sendStatus(500);
    return next('error creating temp directory');
  }

  log.debug('created temporory directory', pathToTmpDir);

  // 3. fetch and write data for each requested dataset (csv + excel metadata sheet)
  const [dataErr, result] = await fetchAndWriteData(
    pathToTmpDir,
    shortNames,
    req.reqId,
  );
  if (dataErr) {
    log.error('fetchAndWriteDataErr', dataErr);
    if (dataErr.message === 'could not find dataset id for dataset name') {
      res.status(400).send('no matching dataset');
      return next('error finding dataset id');
    } else {
      res.status(500).send('error fetching data');
      return next('error fetching data for bulk download');
    }
  }

  // 4. (once all data is fetched) create zip and pipe response

  const safeStreamArchive = safePromise(streamArchive);
  log.info('starting stream response');
  const [streamError, streamResolve] = await safeStreamArchive(
    pathToTmpDir,
    res,
  );
  if (streamError) {
    log.error('error streaming archive response');
    res.status(500).send('error streaming archive');
    return next('error streaming archive for bulk download');
  } else {
    log.debug('streamArchive resolved without error', { streamResolve });
    next();
  }

  // by now, response has been sent: cleanup

  // 5. initate clean-up of temp directory
  const msg = await cleanup(pathToTmpDir);
  moduleLogger.info('cleanup', { msg });
};

module.exports = {
  bulkDownloadController,
};
