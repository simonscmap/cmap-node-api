// change data submission short name
// 1. create temporary folder in dropbox
// 2. commit uploaded file to temporary folder (implemented elsewhere)
// 3. copy files from previous folder
// 4. update record in sql (implemented elsewhere elsewhere)
// 5. rename temporary folder to new name
// 6. delete old folder

const { dropbox } = require('../../utility/Dropbox');
const { safePath } = require('../../utility/objectUtils');
const {
  expBackoffWithMaxCallDepth,
} = require('../../utility/exponentialBackoff');
const { v4: uuidv4 } = require('uuid');

const initializeLogger = require('../../log-service');
let log = initializeLogger(
  'controllers/data-submission/change-submission-name',
);

const listFolderContents = async (path) => {
  if (!path) {
    return ['No path provided'];
  }

  let resp, folderExists, error;
  try {
    resp = await dropbox.filesListFolder({ path });
  } catch (e) {
    if (e && e.status === 409) {
      log.info('folder not found', { responseStatus: e.status });
      folderExists = false;
    } else {
      error = e;
    }
  }
  const contents = safePath(['result', 'entries'])(resp);
  return [error, { folderExists, contents }];
};

const createTempFolder = async (nameOnRecord) => {
  const uuid = uuidv4().slice(0, 5);
  if (!nameOnRecord) {
    return [new Error('No existing file name provided')];
  }
  let error;
  let folderName = `/${nameOnRecord}_tmp_${uuid}`;
  let result;
  log.info('creating temporary folder', {
    stem: nameOnRecord,
    newFolder: folderName,
  });
  try {
    // call dropbox api
    result = await dropbox.filesCreateFolderV2({
      path: folderName,
      autorename: false,
    });
  } catch (e) {
    log.error('error creating temp folder', e);
    error = e;
  }
  log.info('created temp folder', { folderName });
  return [error, { folderName, result }];
};

const copyFiles = async ({ prevPath, newPath }) => {
  log.trace('invoking copyFiles', { prevPath, newPath });

  let contents;

  const [lsErr, lsResult] = await listFolderContents(prevPath);
  if (lsErr) {
    log.error('error listing folder contents', { prevPath, newPath });
    return [lsErr];
  } else {
    contents = lsResult.contents;
  }

  const entries = contents.map((entry) => ({
    from_path: entry.path_display,
    to_path: `${newPath}/${entry.name}`,
  }));

  let resp;
  try {
    resp = await dropbox.filesCopyBatchV2({ entries });
  } catch (e) {
    log.error('error copying folder contents', { entries, ...e });
    console.log(e);
    return [e];
  }

  const jobId = safePath(['result', 'async_job_id'])(resp);

  if (!jobId) {
    return ['No job id provided'];
  } else {
    log.debug('file copy job id', { jobId });
  }

  const runWithh5Retries = expBackoffWithMaxCallDepth(10, true);

  const checkFn = () => dropbox.filesCopyBatchCheckV2({ async_job_id: jobId });
  const checkPred = (r) => 'complete' === safePath(['result', '.tag'])(r);
  const [checkErr, checkResult, metadata] = await runWithh5Retries(
    checkFn,
    checkPred,
  );

  log.info('copy files verified', metadata);

  if (checkErr) {
    return [checkErr];
  } else {
    return [false, { entries, jobId, checkResult }];
  }
};

const renameFolder = async ({ prevPath, newPath }) => {
  log.debug('invoking renameFolder', { prevPath, newPath });
  const arg = {
    from_path: prevPath,
    to_path: newPath,
    autorename: false,
  };
  let result, error;
  try {
    result = await dropbox.filesMoveV2(arg);
    log.info('successfully renamed folder', { ...arg, result });
  } catch (e) {
    log.error('error renaming folder', { ...arg, error: e });
    error = e;
  }
  return [error, result];
};

const deleteFolder = async (folderPath) => {
  log.trace('invoking deleteFolder', { folderPath });
  const arg = {
    path: folderPath,
  };
  let result, error;
  try {
    result = await dropbox.filesDeleteV2(arg);
    log.info('successfully deleted folder', { ...arg, result });
  } catch (e) {
    log.error('error deleting folder', { ...arg, error: e });
    error = e;
  }
  return [error, result];
};

module.exports = {
  createTempFolder,
  copyFiles,
  renameFolder,
  deleteFolder,
};
