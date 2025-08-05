// NOTE: this module is for accessing files in the vault, not the submissions app
// these require different dropbox credentials
const { URL } = require('url');
const { setTimeout } = require('timers');

const dbx = require('../../../utility/DropboxVault');
const { getDatasetId } = require('../../../queries/datasetId');
const directQuery = require('../../../utility/directQuery');
const { safePath, safePathOr } = require('../../../utility/objectUtils');
const initLog = require('../../../log-service');
const getVaultFolderMetadata = require('../getVaultInfo');
const { getCurrentConfig } = require('./batchConfig');
const { executeStagedParallelBatches } = require('./stagedParallelExecutor');
const { logDropboxVaultDownload } = require('./vaultLogger');
const { safeDropboxDelete, scheduleCleanup } = require('./tempCleanup');

const moduleLogger = initLog('controllers/data/dropbox-vault/vaultController');
const CHUNK_SIZE = 2000;
const FILE_COUNT_THRESHOLD_FOR_DIRECT_DOWNLOAD = 5;
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

// Function to get all files in a folder (no subfolders expected)
const getFilesFromFolder = async (path, options = {}, log) => {
  const {
    limit = CHUNK_SIZE, // Default chunk size
    cursor = null, // For fetching specific page
    includeTotal = true, // Whether to include total count
  } = options;

  try {
    let response;
    let entries = [];
    let totalCount = null;

    if (cursor) {
      // Continue from previous cursor
      response = await dbx.filesListFolderContinue({ cursor });
    } else {
      // Initial request
      response = await dbx.filesListFolder({
        path,
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_non_downloadable_files: false,
        limit,
      });
    }

    // Process entries
    entries = response.result.entries
      .filter((entry) => entry['.tag'] === 'file')
      .map((file) => ({
        name: file.name,
        path: file.path_display,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
      }));

    // Get total count if requested (requires full traversal)
    if (includeTotal && !cursor) {
      totalCount = await getTotalFileCount(path, log);
    }

    return [
      null,
      {
        files: entries,
        cursor: response.result.has_more ? response.result.cursor : null,
        hasMore: response.result.has_more,
        totalCount,
      },
    ];
  } catch (error) {
    // Check if it's a "not found" error, which is fine (empty folder)
    if (
      error.status === 409 &&
      error.error.error_summary.includes('path/not_found')
    ) {
      log.info('Folder not found or empty', { path });
      return [
        null,
        {
          files: [],
          cursor: null,
          hasMore: false,
          totalCount: 0,
        },
      ];
    }

    log.error('Error getting files from folder', { path, error });
    return [error, null];
  }
};

// Helper to get total file count
const getTotalFileCount = async (path, log) => {
  let count = 0;
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const response = cursor
      ? await dbx.filesListFolderContinue({ cursor })
      : await dbx.filesListFolder({ path, recursive: false });

    count += response.result.entries.filter((e) => e['.tag'] === 'file').length;
    cursor = response.result.cursor;
    hasMore = response.result.has_more;
  }

  return count;
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Helper function to get folder path based on folder type
const getFolderPath = (folderType, vaultPath) => {
  return `/vault/${vaultPath}${folderType}`;
};

// Helper function to check all folders for availability
const checkAllFolders = async (repPath, nrtPath, rawPath, log) => {
  try {
    const results = await Promise.all([
      getFilesFromFolder(repPath, { limit: 1, includeTotal: true }, log),
      getFilesFromFolder(nrtPath, { limit: 1, includeTotal: true }, log),
      getFilesFromFolder(rawPath, { limit: 1, includeTotal: true }, log),
    ]);

    return {
      hasRep: results[0][1] && results[0][1].totalCount > 0,
      hasNrt: results[1][1] && results[1][1].totalCount > 0,
      hasRaw: results[2][1] && results[2][1].totalCount > 0,
    };
  } catch (error) {
    log.error('Error checking folder availability', { error });
    throw error;
  }
};

// Helper function to determine main folder based on priority
const determineMainFolder = (availableFolders) => {
  if (availableFolders.hasRep) return 'rep';
  if (availableFolders.hasNrt) return 'nrt';
  if (availableFolders.hasRaw) return 'raw';
  return null; // No files found
};

// Helper function to generate direct folder download link
const generateFolderDownloadLink = async (folderPath, shortName, log) => {
  try {
    const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
      path: folderPath,
      settings: {
        requested_visibility: 'public',
        access: 'viewer',
      },
    });

    // Convert to direct download link
    const directDownloadLink = forceDropboxFolderDownload(
      sharedLinkResponse.result.url,
    );

    log.info('Generated direct folder download link', {
      folderPath,
      shortName,
      directDownloadLink,
    });

    return directDownloadLink;
  } catch (error) {
    // Check if link already exists
    if (
      error.status === 409 &&
      error.error &&
      error.error.error_summary &&
      error.error.error_summary.includes('shared_link_already_exists')
    ) {
      // Try to get existing link
      try {
        const listSharedLinksResponse = await dbx.sharingListSharedLinks({
          path: folderPath,
          direct_only: true,
        });

        const existingLink = safePath(['result', 'links', 0, 'url'])(
          listSharedLinksResponse,
        );
        if (existingLink) {
          const directDownloadLink = forceDropboxFolderDownload(existingLink);
          log.info('Retrieved existing direct folder download link', {
            folderPath,
            shortName,
            directDownloadLink,
          });
          return directDownloadLink;
        }
      } catch (listError) {
        log.error('Failed to retrieve existing shared link', {
          folderPath,
          shortName,
          error: listError,
        });
      }
    }

    log.error('Failed to generate folder download link', {
      folderPath,
      shortName,
      error: error.message,
      status: error.status,
    });
    throw error;
  }
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

  // Parse query parameters
  const folderType = req.query.folderType; // 'rep', 'nrt', 'raw', or undefined
  const chunkSize = req.query.chunkSize || CHUNK_SIZE;
  const cursor = req.query.cursor || null;

  if (!shortName) {
    log.warn('No short name provided', { params: req.params });
    return res.status(400).json({ error: 'Dataset short name is required' });
  }

  // Validate folderType parameter if provided
  if (folderType && !['rep', 'nrt', 'raw'].includes(folderType)) {
    log.warn('Invalid folderType parameter', { folderType });
    return res
      .status(400)
      .json({ error: 'Invalid folderType. Must be one of: rep, nrt, raw' });
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

  // 3. Set up folder paths
  const vaultPath = ensureTrailingSlash(result.Vault_Path);
  const repPath = getFolderPath('rep', vaultPath);
  const nrtPath = getFolderPath('nrt', vaultPath);
  const rawPath = getFolderPath('raw', vaultPath);

  try {
    // 4. Check all folders for availability
    const availableFolders = await checkAllFolders(
      repPath,
      nrtPath,
      rawPath,
      log,
    );

    // 5. Determine main folder based on priority
    const mainFolder = determineMainFolder(availableFolders);

    if (!mainFolder) {
      log.warn('No files found in any vault folder', {
        repPath,
        nrtPath,
        rawPath,
        availableFolders,
      });
      return res.status(404).json({ error: 'No files found in vault folders' });
    }

    // 6. Determine which folder to fetch files from
    const targetFolder = folderType || mainFolder;

    // 7. Validate that requested folder exists if folderType was specified
    if (folderType) {
      const folderKey = `has${
        folderType.charAt(0).toUpperCase() + folderType.slice(1)
      }`;
      if (!availableFolders[folderKey]) {
        log.warn('Requested folder type has no files', {
          folderType,
          availableFolders,
        });
        return res.status(404).json({
          error: `No files found in ${folderType.toUpperCase()} folder`,
          availableFolders,
        });
      }
    }

    // 8. Fetch files from target folder
    const targetPath = getFolderPath(targetFolder, vaultPath);
    const [folderErr, folderResult] = await getFilesFromFolder(
      targetPath,
      {
        limit: chunkSize,
        cursor,
        includeTotal: !cursor, // Only get total on first page
      },
      log,
    );

    if (folderErr) {
      log.error(
        `Error fetching files from ${targetFolder.toUpperCase()} folder`,
        {
          path: targetPath,
          error: folderErr,
        },
      );
      return res.status(500).json({ error: 'Error fetching vault files' });
    }

    // 9. Check if auto-download is eligible and generate direct download link
    const autoDownloadEligible =
      folderResult.totalCount &&
      folderResult.totalCount <= FILE_COUNT_THRESHOLD_FOR_DIRECT_DOWNLOAD;
    let directDownloadLink = null;

    if (autoDownloadEligible) {
      try {
        directDownloadLink = await generateFolderDownloadLink(
          targetPath,
          shortName,
          log,
        );
      } catch (error) {
        log.warn(
          'Failed to generate direct download link for auto-download eligible dataset',
          {
            shortName,
            targetPath,
            totalCount: folderResult.totalCount,
            error: error.message,
          },
        );
        // Continue without direct download link - frontend can fall back to file selection
      }
    }

    // 10. Build pagination info
    const paginationInfo = {
      chunkSize: chunkSize,
      hasMore: folderResult.hasMore,
      cursor: folderResult.cursor,
      totalCount: folderResult.totalCount,
      totalChunks: folderResult.totalCount
        ? Math.ceil(folderResult.totalCount / chunkSize)
        : null,
    };

    // Log the operation
    log.info('Retrieved vault files for dataset', {
      shortName,
      availableFolders,
      mainFolder,
      targetFolder,
      currentPageCount: folderResult.files.length,
      pagination: paginationInfo,
      autoDownloadEligible,
      hasDirectDownloadLink: !!directDownloadLink,
    });

    // 11. Return enhanced response with folder availability info and smart download fields
    const payload = {
      shortName,
      datasetId,
      availableFolders,
      mainFolder,
      files: folderResult.files,
      pagination: paginationInfo,
      summary: {
        folderUsed: targetFolder,
        currentPageCount: folderResult.files.length,
        currentPageSize: folderResult.files.reduce(
          (sum, file) => sum + file.size,
          0,
        ),
      },
      folderType: targetFolder,
      // Keep selectedFolder for backwards compatibility
      selectedFolder: targetFolder,
      // Feature A: Smart download fields
      autoDownloadEligible,
      ...(directDownloadLink && { directDownloadLink }),
    };

    return res.json(payload);
  } catch (error) {
    log.error('Error in getVaultFilesInfo', {
      shortName,
      datasetId,
      folderType,
      error: error.message,
      stack: error.stack,
    });
    return res
      .status(500)
      .json({ error: 'Error retrieving vault information' });
  }
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
  const tempFolderName = `${shortName}-${timestamp}-${randomSuffix}`;
  return `/temp-downloads/${tempFolderName}`;
};

// Helper function to create temporary folder in /temp-downloads (sibling to /vault)
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

  const copyBatchResult = await dbx.filesCopyBatchV2({
    entries: copyEntries,
    autorename: true, // Rename if conflicts occur
  });

  if (copyBatchResult.result['.tag'] === 'complete') {
    log.info('Batch copy completed immediately');
    return { completed: true };
  } else if (copyBatchResult.result['.tag'] === 'async_job_id') {
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

    const checkResult = await dbx.filesCopyBatchCheckV2({
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

  try {
    // First verify the folder exists
    await dbx.filesGetMetadata({ path: tempFolderPath });

    const shareLinkResult = await dbx.sharingCreateSharedLinkWithSettings({
      path: tempFolderPath,
      settings: {
        require_password: false,
        allow_download: true,
      },
    });

    const shareLink = shareLinkResult.result.url;
    // Force download by changing dl=0 to dl=1
    const downloadLink = forceDropboxFolderDownload(shareLink);

    log.info('Download link created successfully', {
      tempFolderPath,
      downloadLink,
    });

    return downloadLink;
  } catch (error) {
    log.error('Failed to create shared link', {
      tempFolderPath,
      error: error.message,
      status: error.status,
      errorSummary: error.error && error.error.error_summary,
    });
    throw error;
  }
};

// Helper function to handle direct folder download when all files are selected
const handleDirectFolderDownload = async (vaultPath, shortName, log) => {
  try {
    const directDownloadLink = await generateFolderDownloadLink(
      vaultPath,
      shortName,
      log,
    );

    return {
      success: true,
      downloadLink: directDownloadLink,
      downloadType: 'direct_folder',
      message: 'All files selected. Direct folder download available.',
    };
  } catch (error) {
    log.error('Error creating direct folder download', {
      shortName,
      vaultPath,
      error,
    });
    throw new Error('Failed to create direct download link');
  }
};

// Helper function to handle selective file download using temp folder
const handleSelectiveFileDownload = async (shortName, files, log) => {
  // Get current configuration
  const config = getCurrentConfig();

  log.info('Using batch configuration for selective download', {
    configName: config.name,
    config: config,
    fileCount: files.length,
  });

  const tempFolderPath = generateTempFolderPath(shortName);

  try {
    // Create temporary folder
    await createTempFolder(tempFolderPath, log);

    // Execute staged parallel batches
    await executeStagedParallelBatches(files, tempFolderPath, config, dbx);

    // Create download link
    const downloadLink = await createDownloadLink(tempFolderPath, log);

    // Schedule cleanup (runs async in background)
    scheduleCleanup();

    return {
      success: true,
      downloadLink,
      downloadType: 'selective',
      message:
        'Files copied using staged parallel execution. Download will begin shortly.',
      fileCount: files.length,
      configUsed: config.name,
    };
  } catch (error) {
    // Cleanup after error
    await cleanupAfterError(tempFolderPath, log);
    throw error;
  }
};

// Helper function to get total file count for a dataset
const getDatasetTotalFileCount = async (shortName, log) => {
  try {
    // Get dataset ID from short name
    const datasetId = await getDatasetId(shortName, log);
    if (!datasetId) {
      throw new Error('Dataset not found');
    }

    // Get vault record for this dataset
    const qs = `select top 1 * from tblDataset_Vault where Dataset_ID=${datasetId};`;
    const [err, vaultResp] = await directQuery(qs, undefined, log);
    if (err) {
      throw new Error('Error retrieving vault record');
    }

    const result = safePath(['recordset', 0])(vaultResp);
    if (!result) {
      throw new Error('No vault record found');
    }

    // Set up folder paths
    const vaultPath = ensureTrailingSlash(result.Vault_Path);
    const repPath = getFolderPath('rep', vaultPath);
    const nrtPath = getFolderPath('nrt', vaultPath);
    const rawPath = getFolderPath('raw', vaultPath);

    // Check all folders for availability
    const availableFolders = await checkAllFolders(
      repPath,
      nrtPath,
      rawPath,
      log,
    );

    // Determine main folder based on priority
    const mainFolder = determineMainFolder(availableFolders);
    if (!mainFolder) {
      throw new Error('No files found in vault folders');
    }

    // Get total count from main folder
    const targetPath = getFolderPath(mainFolder, vaultPath);
    const totalCount = await getTotalFileCount(targetPath, log);

    return { totalCount, vaultPath: targetPath };
  } catch (error) {
    log.error('Error getting dataset total file count', {
      shortName,
      error: error.message,
    });
    throw error;
  }
};

// Helper function to handle cleanup after error
const cleanupAfterError = async (tempFolderPath, log) => {
  try {
    await safeDropboxDelete(dbx, tempFolderPath);
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
  if (error.status === 400) {
    return {
      status: 400,
      json: {
        error:
          'Invalid request. The temporary folder may not exist or may be inaccessible.',
        details:
          process.env.NODE_ENV === 'development'
            ? error.error && error.error.error_summary
            : undefined,
      },
    };
  }

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

const downloadDropboxVaultFilesWithStagedParallel = async (req, res) => {
  const log = moduleLogger.setReqId(req.reqId);
  const { shortName, datasetId, files, totalSize } = req.body;

  log.info('downloadDropboxVaultFiles - using staged parallel execution', {
    shortName,
    datasetId,
    fileCount: files ? files.length : undefined,
    totalSize,
  });

  // Step 1: Validate input
  const validation = validateDownloadRequest(files, shortName, datasetId, log);
  if (!validation.valid) {
    return res.status(validation.status).json({ error: validation.error });
  }

  try {
    // Step 2: Feature B - Check if all files are selected
    const { totalCount, vaultPath } = await getDatasetTotalFileCount(
      shortName,
      log,
    );
    const allFilesSelected = files.length === totalCount;

    log.info('Feature B: All files selection check', {
      shortName,
      selectedFileCount: files.length,
      totalFileCount: totalCount,
      allFilesSelected,
    });

    if (allFilesSelected) {
      // Step 3a: Handle direct folder download
      const result = await handleDirectFolderDownload(
        vaultPath,
        shortName,
        log,
      );

      // Log success
      logDropboxVaultDownload(req, {
        shortName,
        datasetId,
        files,
        totalSize,
        success: true,
        downloadType: 'direct_folder',
      });

      return res.json(result);
    } else {
      // Step 3b: Handle selective file download with temp folder
      const result = await handleSelectiveFileDownload(shortName, files, log);

      // Log success
      logDropboxVaultDownload(req, {
        shortName,
        datasetId,
        files,
        totalSize,
        success: true,
        downloadType: 'selective',
      });

      return res.json(result);
    }
  } catch (error) {
    // Log error
    logDropboxVaultDownload(req, {
      shortName,
      datasetId,
      files,
      totalSize,
      success: false,
      error,
    });

    // Handle and return error response
    const errorResponse = handleDropboxError(error, log);
    return res.status(errorResponse.status).json(errorResponse.json);
  }
};

module.exports = {
  getShareLinkController,
  getVaultFilesInfo,
  downloadDropboxVaultFiles: downloadDropboxVaultFilesWithStagedParallel, // Use new implementation
};
