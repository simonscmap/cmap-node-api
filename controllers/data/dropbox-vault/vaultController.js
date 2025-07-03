// NOTE: this module is for accessing files in the vault, not the submissions app
// these require different dropbox credentials
const { URL } = require('url');
const { setTimeout } = require('timers');
// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const archiver = require('archiver');
// const { promisify } = require('util');
// const mkdtemp = promisify(fs.mkdtemp);

const dbx = require('../../../utility/DropboxVault');
const { getDatasetId } = require('../../../queries/datasetId');
const directQuery = require('../../../utility/directQuery');
const { safePath, safePathOr } = require('../../../utility/objectUtils');
const initLog = require('../../../log-service');
const getVaultFolderMetadata = require('../getVaultInfo');

const moduleLogger = initLog('controllers/data/dropbox-vault/vaultController');

const safePathOrEmpty = safePathOr([])(
  (val) => Array.isArray(val) && val.length > 0,
);

const ensureTrailingSlash = (path = '') => {
  if (path.length === 0) {
    return path;
  } else if (path.charAt(path.length - 1) !== '/') {
    return `${path}/`;
  } else {
    return path;
  }
};
function forceDropboxFolderDownload(dropboxLink) {
  const url = new URL(dropboxLink);
  url.searchParams.set('dl', '1');
  return url.toString();
}

// Function to recursively get all files in a folder including subfolders
const getFilesRecursively = async (path, log) => {
  const dropbox = dbx;

  // Helper function to handle pagination
  const listFolderContinue = async (files, cursor) => {
    try {
      const response = await dropbox.filesListFolderContinue({ cursor });

      // Process files from this batch
      const newFiles = response.result.entries
        .filter((entry) => entry['.tag'] === 'file')
        .map((file) => ({
          name: file.name,
          path: file.path_display,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
        }));

      const allFiles = [...files, ...newFiles];

      // If there are more files, continue pagination
      if (response.result.has_more) {
        return await listFolderContinue(allFiles, response.result.cursor);
      }

      return allFiles;
    } catch (error) {
      log.error('Error in pagination', { cursor, error });
      // Return files collected so far even if pagination fails
      return files;
    }
  };

  try {
    // Initial folder listing
    const listFolderResponse = await dropbox.filesListFolder({
      path,
      recursive: true,
      include_media_info: false,
      include_deleted: false,
      include_non_downloadable_files: false,
    });

    // Process files from initial response
    let files = listFolderResponse.result.entries
      .filter((entry) => entry['.tag'] === 'file')
      .map((file) => ({
        name: file.name,
        path: file.path_display,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
      }));

    // If there are more files, handle pagination
    if (listFolderResponse.result.has_more) {
      files = await listFolderContinue(files, listFolderResponse.result.cursor);
    }

    return [null, files];
  } catch (error) {
    // Check if it's a "not found" error, which is fine (empty folder)
    if (
      error.status === 409 &&
      error.error.error_summary.includes('path/not_found')
    ) {
      log.info('Folder not found or empty', { path });
      return [null, []];
    }

    log.error('Error getting files recursively', { path, error });
    return [error, null];
  }
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Safe deletion function that guards against deleting vault files
const safeDropboxDelete = async (dropbox, path, log) => {
  // Guard against deleting anything with 'vault' in the path
  if (path.toLowerCase().includes('vault')) {
    const error = new Error(
      `SAFETY GUARD: Attempted to delete path containing 'vault': ${path}`,
    );
    log.error('BLOCKED DANGEROUS DELETION ATTEMPT', {
      path,
      error: error.message,
    });
    throw error;
  }

  // Additional safety check for empty or root paths
  if (!path || path === '/' || path.trim() === '') {
    const error = new Error(
      `SAFETY GUARD: Attempted to delete empty or root path: ${path}`,
    );
    log.error('BLOCKED DANGEROUS DELETION ATTEMPT', {
      path,
      error: error.message,
    });
    throw error;
  }

  log.info('Safe deletion proceeding', { path });
  return await dropbox.filesDeleteV2({ path });
};

// vaultController: return a share link to the correct folder given a shortName

// 1. get dataset id from short name
// 2. look up vault record by dataset id
// 3. vault folder contents and choose a path (rep, raw, nrt)
// 4. create share link
// 5. get metadata
// 6. return payload

const getShareLinkController = async (req, res) => {
  const log = moduleLogger.setReqId(req.reqId);

  // 0.
  const dropbox = dbx;

  // 1.
  const shortName = req.params.shortName;

  if (!shortName) {
    log.warn('no short name provided', { params: req.params });
    return res.sendStatus(400);
  }

  const datasetId = await getDatasetId(shortName, log);

  if (!datasetId) {
    log.error('no dataset id found for short name', { shortName });
    return res.sendStatus(404);
  }

  // 2.
  const qs = `select top 1 * from tblDataset_Vault where Dataset_ID=${datasetId};`;
  const [err, vaultResp] = await directQuery(qs, undefined, log);
  if (err) {
    log.error('error retrieving vault record', {
      shortName,
      datasetId,
      error: err,
    });
    return res.sendStatus(500);
  }

  const result = safePath(['recordset', 0])(vaultResp);
  if (!result) {
    log.error('no vault record found', { shortName, datasetId });
    return res.sendStatus(404);
  }

  // 3.
  log.info('retrieved valut info', result);
  const vaultPath = ensureTrailingSlash(result.Vault_Path);
  const repPath = `/vault/${vaultPath}rep`;
  const nrtPath = `/vault/${vaultPath}nrt`;
  const rawPath = `/vault/${vaultPath}raw`;

  let repResp;
  try {
    repResp = await dropbox.filesListFolder({ path: repPath });
  } catch (e) {
    log.error('dropbox error: filesListFolder', {
      path: repPath,
      error: e.error,
      status: e.status,
    });
    return res.sendStatus(500);
  }
  const repContents = safePathOrEmpty(['result', 'entries'])(repResp);

  let nrtResp;
  try {
    nrtResp = await dropbox.filesListFolder({ path: nrtPath });
  } catch (e) {
    log.error('dropbox error: filesListFolder', {
      path: nrtPath,
      error: e.error,
      status: e.status,
    });
    return res.sendStatus(500);
  }
  const nrtContents = safePathOrEmpty(['result', 'entries'])(nrtResp);

  let rawResp;
  try {
    rawResp = await dropbox.filesListFolder({ path: rawPath });
  } catch (e) {
    log.error('dropbox error: filedListFolder', {
      path: rawPath,
      error: e.error,
      status: e.status,
    });
    return res.sendStatus(500);
  }
  const rawContents = safePathOrEmpty(['result', 'entries'])(rawResp);

  let folderName;
  let folderPath;
  if (repContents.length) {
    folderName = 'rep';
    folderPath = repPath;
    console.log(repContents[0]);
  } else if (nrtContents.length) {
    folderName = 'nrt';
    folderPath = nrtPath;
    console.log(nrtContents[0]);
  } else if (rawContents.length) {
    folderName = 'raw';
    folderPath = rawPath;
    console.log(rawContents[0]);
  } else {
    log.warn('no dataset vault folders contain files', {
      vaultPath,
      shortName,
      datasetId,
    });
    return res.sendStatus(404);
  }

  // 4. get share link

  // 4. a) check if link already exists

  const listSharedLinksArg = { path: folderPath, direct_only: true };
  let listSharedLinksResp;
  try {
    listSharedLinksResp = await dropbox.sharingListSharedLinks(
      listSharedLinksArg,
    );
  } catch (e) {
    log.error('dropbox error: listSharedLinks', {
      ...listSharedLinksArg,
      error: e.error,
      status: e.status,
    });
    return res.sendStatus(500);
  }

  let link = safePath(['result', 'links', 0, 'url'])(listSharedLinksResp);

  if (link) {
    link = forceDropboxFolderDownload(link);
    log.info('retrieved existing dropbox share link', {
      path: folderPath,
      url: link,
    });
  } else {
    // 4. b) if no existing link, create one
    const arg = {
      path: folderPath,
      settings: {
        require_password: false,
        expires: undefined, // does not expire
        allow_download: true,
      },
    };

    let shareLinkResp;
    try {
      shareLinkResp = await dropbox.sharingCreateSharedLinkWithSettings(arg);
    } catch (e) {
      log.error('dropbox error: sharingCreateSharedLinkWithSettings', arg);
      console.log(e);
      return res.sendStatus(500);
    }

    const newShareLink = safePath(['result', 'url'])(shareLinkResp);

    if (!newShareLink) {
      log.error('no new share link returned', {
        path: folderPath,
        resp: shareLinkResp,
      });
      return res.sendStatus(500);
    }

    link = forceDropboxFolderDownload(newShareLink);
  }

  // 5. metadata
  const [mdErr, metadata] = await getVaultFolderMetadata(folderPath, log);
  if (mdErr) {
    res.status(500).send('error retrieving metadata');
  }

  // 6. return
  const payload = {
    shortName,
    datasetId,
    folderPath,
    folderName,
    shareLink: link,
    metadata: {
      totalSize: metadata.sizeString,
      fileCount: metadata.count,
    },
  };

  return res.json(payload);
};

// New controller to get detailed file information for a dataset
const getVaultFilesInfo = async (req, res) => {
  const log = moduleLogger.setReqId(req.reqId);

  // Get the dataset short name from request
  const shortName = req.params.shortName;

  if (!shortName) {
    log.warn('No short name provided', { params: req.params });
    return res.status(400).json({ error: 'Dataset short name is required' });
  }

  // 1. Get dataset ID from short name
  const datasetId = await getDatasetId(shortName, log);

  if (!datasetId) {
    log.error('No dataset id found for short name', { shortName });
    return res.status(404).json({ error: 'Dataset not found' });
  }

  // 2. Get vault record for this dataset
  const qs = `select top 1 * from tblDataset_Vault where Dataset_ID=${datasetId};`;
  const [err, vaultResp] = await directQuery(qs, undefined, log);

  if (err) {
    log.error('Error retrieving vault record', {
      shortName,
      datasetId,
      error: err,
    });
    return res
      .status(500)
      .json({ error: 'Error retrieving vault information' });
  }

  const result = safePath(['recordset', 0])(vaultResp);
  if (!result) {
    log.error('No vault record found', { shortName, datasetId });
    return res.status(404).json({ error: 'No vault record found for dataset' });
  }

  // 3. Get file information from the vault folders (sequential priority: REP -> NRT -> RAW)
  const vaultPath = ensureTrailingSlash(result.Vault_Path);
  const parentVaultPath = `/vault/${vaultPath}`;
  const repPath = `${parentVaultPath}rep`;
  const nrtPath = `${parentVaultPath}nrt`;
  const rawPath = `${parentVaultPath}raw`;

  // Get all files from the vault directory in one async call
  const [vaultErr, allFiles] = await getFilesRecursively(parentVaultPath, log);

  if (vaultErr) {
    log.error('Error retrieving vault files', {
      parentVaultPath,
      error: vaultErr,
    });
    return res.status(500).json({ error: 'Error retrieving vault files' });
  }

  // Synchronously group files by folder
  const filesByFolder = {
    rep: allFiles.filter((file) => file.path.startsWith(repPath)),
    nrt: allFiles.filter((file) => file.path.startsWith(nrtPath)),
    raw: allFiles.filter((file) => file.path.startsWith(rawPath)),
  };

  // Apply priority logic: REP -> NRT -> RAW
  let selectedFolder = null;
  let selectedFiles = [];
  let selectedPath = null;

  if (filesByFolder.rep.length > 0) {
    selectedFolder = 'rep';
    selectedFiles = filesByFolder.rep;
    selectedPath = repPath;
  } else if (filesByFolder.nrt.length > 0) {
    selectedFolder = 'nrt';
    selectedFiles = filesByFolder.nrt;
    selectedPath = nrtPath;
  } else if (filesByFolder.raw.length > 0) {
    selectedFolder = 'raw';
    selectedFiles = filesByFolder.raw;
    selectedPath = rawPath;
  } else {
    log.warn('No files found in any vault folder', {
      parentVaultPath,
      repPath,
      nrtPath,
      rawPath,
      totalFiles: allFiles.length,
    });
    return res.status(404).json({ error: 'No files found in vault folders' });
  }

  // Log once at the end with the selected folder info
  log.info('Selected vault folder for dataset', {
    shortName,
    selectedFolder,
    selectedPath,
    fileCount: selectedFiles.length,
    totalVaultFiles: allFiles.length,
  });

  // 4. Return the payload with file information from selected folder only
  const payload = {
    shortName,
    datasetId,
    selectedFolder,
    files: selectedFiles,
    summary: {
      folderUsed: selectedFolder,
      fileCount: selectedFiles.length,
      totalSize: selectedFiles.reduce((sum, file) => sum + file.size, 0),
    },
  };

  return res.json(payload);
};

// Helper function to validate download request
const validateDownloadRequest = (files, shortName, datasetId, log) => {
  if (!files || !Array.isArray(files) || files.length === 0) {
    log.warn('No files provided for download', { shortName, datasetId });
    return { error: 'No files provided for download', status: 400 };
  }

  if (files.length > 1000) {
    log.warn('Too many files requested for batch operation', {
      shortName,
      datasetId,
      fileCount: files.length,
    });
    return {
      error: 'Maximum 1000 files can be downloaded at once',
      status: 400,
    };
  }

  return { valid: true };
};

// Helper function to generate temporary folder path
const generateTempFolderPath = (shortName) => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const tempFolderName = `temp-download-${shortName}-${timestamp}-${randomSuffix}`;
  return `/temp-downloads/${tempFolderName}`;
};

// Helper function to create temporary folder
const createTempFolder = async (tempFolderPath, log) => {
  log.info('Creating temporary folder', { tempFolderPath });

  try {
    // Ensure parent directory exists
    await dbx.filesCreateFolderV2({ path: '/temp-downloads' });
  } catch (parentDirError) {
    // Ignore error if directory already exists
    if (
      parentDirError.status !== 409 ||
      !(
        parentDirError.error &&
        parentDirError.error.error_summary &&
        parentDirError.error.error_summary.includes('path/conflict')
      )
    ) {
      throw parentDirError;
    }
  }

  await dbx.filesCreateFolderV2({ path: tempFolderPath });
};

// Helper function to prepare batch copy entries
const prepareBatchCopyEntries = (files, tempFolderPath) => {
  return files.map((file) => ({
    from_path: file.filePath,
    to_path: `${tempFolderPath}/${file.name}`,
  }));
};

// Helper function to execute batch copy
const executeBatchCopy = async (copyEntries, log) => {
  log.info('Starting batch copy operation', {
    entryCount: copyEntries.length,
  });

  const copyBatchResult = await dbx.filesCopyBatch({
    entries: copyEntries,
    autorename: true, // Rename if conflicts occur
  });

  if (copyBatchResult.result['.tag'] === 'complete') {
    log.info('Batch copy completed immediately');
    return { completed: true };
  } else if (copyBatchResult.result['.tag'] === 'in_progress') {
    const batchJobId = copyBatchResult.result.async_job_id;
    log.info('Batch copy started as async job', { batchJobId });
    return { completed: false, batchJobId };
  } else {
    throw new Error(
      `Unexpected batch copy result: ${copyBatchResult.result['.tag']}`,
    );
  }
};

// Helper function to wait for batch copy completion
const waitForBatchCopyCompletion = async (batchJobId, log) => {
  const maxWaitTime = 60000; // 60 seconds
  const pollInterval = 2000; // 2 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const checkResult = await dbx.filesCopyBatchCheck({
      async_job_id: batchJobId,
    });

    if (checkResult.result['.tag'] === 'complete') {
      log.info('Batch copy completed', { batchJobId });
      return;
    } else if (checkResult.result['.tag'] === 'failed') {
      throw new Error(
        `Batch copy failed: ${JSON.stringify(checkResult.result)}`,
      );
    }
    // If still in_progress, continue polling
  }

  throw new Error('Batch copy operation timed out');
};

// Helper function to create download link
const createDownloadLink = async (tempFolderPath, log) => {
  log.info('Creating shared link for temporary folder', { tempFolderPath });

  const shareLinkResult = await dbx.sharingCreateSharedLinkWithSettings({
    path: tempFolderPath,
    settings: {
      require_password: false,
      allow_download: true,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Expires in 24 hours
    },
  });

  const shareLink = shareLinkResult.result.url;
  // Force download by changing dl=0 to dl=1
  const downloadLink = shareLink.replace('dl=0', 'dl=1');

  log.info('Download link created successfully', {
    tempFolderPath,
    downloadLink,
  });

  return downloadLink;
};

// Helper function to schedule cleanup
const scheduleCleanup = (tempFolderPath, log) => {
  const cleanupDelayMs = 2 * 60 * 60 * 1000; // 2 hours
  setTimeout(async () => {
    try {
      await safeDropboxDelete(dbx, tempFolderPath, log);
      log.info('Temporary folder cleaned up successfully', {
        tempFolderPath,
      });
    } catch (cleanupError) {
      log.error('Failed to clean up temporary folder', {
        tempFolderPath,
        error: cleanupError,
      });
    }
  }, cleanupDelayMs);
};

// Helper function to handle cleanup after error
const cleanupAfterError = async (tempFolderPath, log) => {
  try {
    await safeDropboxDelete(dbx, tempFolderPath, log);
    log.info('Cleaned up temporary folder after error', { tempFolderPath });
  } catch (cleanupError) {
    log.error('Failed to clean up temporary folder after error', {
      tempFolderPath,
      cleanupError,
    });
  }
};

// Helper function to handle specific Dropbox errors
const handleDropboxError = (error, log) => {
  log.error('Error in downloadDropboxVaultFiles', {
    error: error.message,
    stack: error.stack,
  });

  // Handle specific Dropbox API errors
  if (
    error.status === 409 &&
    error.error &&
    error.error.error_summary &&
    error.error.error_summary.includes('too_many_write_operations')
  ) {
    return {
      status: 429,
      json: {
        error: 'Too many operations in progress. Please try again in a moment.',
        retryAfter: 30,
      },
    };
  }

  if (
    error.status === 409 &&
    error.error &&
    error.error.error_summary &&
    error.error.error_summary.includes('insufficient_space')
  ) {
    return {
      status: 507,
      json: {
        error: 'Insufficient storage space in Dropbox account.',
      },
    };
  }

  return {
    status: 500,
    json: {
      error: 'Failed to prepare download. Please try again.',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    },
  };
};

const downloadDropboxVaultFiles = async (req, res) => {
  const log = moduleLogger.setReqId(req.reqId);
  const { shortName, datasetId, files } = req.body;

  log.info('downloadDropboxVaultFiles - using Dropbox batch copy', {
    shortName,
    datasetId,
    fileCount: files ? files.length : undefined,
  });

  // Step 1: Validate input
  const validation = validateDownloadRequest(files, shortName, datasetId, log);
  if (!validation.valid) {
    return res.status(validation.status).json({ error: validation.error });
  }

  const tempFolderPath = generateTempFolderPath(shortName);

  try {
    // Step 2: Create temporary folder
    await createTempFolder(tempFolderPath, log);

    // Step 3: Prepare and execute batch copy
    const copyEntries = prepareBatchCopyEntries(files, tempFolderPath);
    const copyResult = await executeBatchCopy(copyEntries, log);

    // Step 4: Wait for completion if async
    if (!copyResult.completed) {
      await waitForBatchCopyCompletion(copyResult.batchJobId, log);
    }

    // Step 5: Create download link
    const downloadLink = await createDownloadLink(tempFolderPath, log);

    // Step 6: Schedule cleanup
    scheduleCleanup(tempFolderPath, log);

    // Step 7: Return success response
    return res.json({
      success: true,
      downloadLink,
      message: 'Files copied to temporary folder. Download will begin shortly.',
      fileCount: files.length,
      expiresIn: '24 hours',
    });
  } catch (error) {
    // Cleanup after error
    await cleanupAfterError(tempFolderPath, log);

    // Handle and return error response
    const errorResponse = handleDropboxError(error, log);
    return res.status(errorResponse.status).json(errorResponse.json);
  }
};

module.exports = {
  getShareLinkController,
  getVaultFilesInfo,
  downloadDropboxVaultFiles,
  safeDropboxDelete,
};
