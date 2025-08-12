const dbx = require('../../../utility/DropboxVault');
const { setCachedVaultCount, getCachedVaultCount } = require('./vaultCache');
const CHUNK_SIZE = 2000;

// Helper function to get folder path based on folder type
const getFolderPath = (folderType, vaultPath) => {
  return `/vault/${vaultPath}${folderType}`;
};

// Helper function to ensure trailing slash on path
const ensureTrailingSlash = (path = '') => {
  if (path.length === 0) {
    return path;
  } else if (path.charAt(path.length - 1) !== '/') {
    return `${path}/`;
  } else {
    return path;
  }
};

// Optimized function to check if a folder has any files (no cursors, minimal processing)
const hasFiles = async (path, log) => {
  try {
    const response = await dbx.filesListFolder({
      path,
      recursive: false,
      include_media_info: false,
      include_deleted: false,
      include_non_downloadable_files: false,
      limit: 1,
    });

    const hasAnyFiles = response.result.entries.some((entry) => entry['.tag'] === 'file');
    return [null, hasAnyFiles];
  } catch (error) {
    if (
      error.status === 409 &&
      error.error.error_summary.includes('path/not_found')
    ) {
      log.info('Folder not found or empty', { path });
      return [null, false];
    }

    log.error('Error checking if folder has files', { path, error });
    return [error, null];
  }
};

// Helper function to check all folders for availability
const checkAllFolders = async (repPath, nrtPath, rawPath, log) => {
  const startTime = Date.now();

  try {
    const results = await Promise.all([
      hasFiles(repPath, log),
      hasFiles(nrtPath, log),
      hasFiles(rawPath, log),
    ]);

    const endTime = Date.now();
    const duration = endTime - startTime;

    const folderAvailability = {
      hasRep: results[0][1] === true,
      hasNrt: results[1][1] === true,
      hasRaw: results[2][1] === true,
    };

    log.info('checkAllFolders performance', {
      duration,
      folderAvailability,
    });

    return folderAvailability;
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    log.error('Error checking folder availability', { error, duration });
    throw error;
  }
};

/**
 * Sets up vault folder paths and checks their availability
 * @param {string} vaultPath - Base vault path
 * @param {Object} log - Logger instance
 * @returns {Promise<Object>} - { availableFolders, repPath, nrtPath, rawPath, checkFoldersDuration }
 */
const setupAndCheckVaultFolders = async (vaultPath, log) => {
  const normalizedVaultPath = ensureTrailingSlash(vaultPath);

  const checkFoldersStart = Date.now();
  const availableFolders = await checkAllFolders(
    getFolderPath('rep', normalizedVaultPath),
    getFolderPath('nrt', normalizedVaultPath),
    getFolderPath('raw', normalizedVaultPath),
    log,
  );
  const checkFoldersEnd = Date.now();
  const checkFoldersDuration = checkFoldersEnd - checkFoldersStart;

  return {
    availableFolders,
    checkFoldersDuration,
    vaultPath: normalizedVaultPath,
  };
};

// Helper to get total file count
const getTotalFileCount = async (path) => {
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

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// New function: Get ALL files and total count (with count caching)
const getAllFilesAndCount = async (path, log) => {
  // Check cached count first
  const cachedCount = getCachedVaultCount(path, log);

  // Fetch all files from Dropbox
  const [error, data] = await getAllFilesAndCountFromDropbox(path, log);

  if (error) {
    return [error, null];
  }

  // If we have cached count, use it; otherwise cache the new count
  if (cachedCount !== undefined) {
    data.totalCount = cachedCount;
  } else if (data && data.totalCount !== undefined) {
    setCachedVaultCount(path, data.totalCount, log);
  }

  return [null, data];
};

// Original function: Get ALL files and total count from Dropbox (uncached)
const getAllFilesAndCountFromDropbox = async (path, log) => {
  const allFiles = [];
  let cursor = null;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = cursor
        ? await dbx.filesListFolderContinue({ cursor })
        : await dbx.filesListFolder({
            path,
            recursive: false,
            include_media_info: false,
            include_deleted: false,
            include_non_downloadable_files: false,
          });

      // Process and collect files from this batch
      const batchFiles = response.result.entries
        .filter((entry) => entry['.tag'] === 'file')
        .map((file) => ({
          name: file.name,
          path: file.path_display,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
        }));

      allFiles.push(...batchFiles);
      cursor = response.result.cursor;
      hasMore = response.result.has_more;
    }

    return [
      null,
      {
        files: allFiles,
        totalCount: allFiles.length,
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
          totalCount: 0,
        },
      ];
    }

    log.error('Error getting all files and count from folder', { path, error });
    return [error, null];
  }
};

module.exports = {
  getFilesFromFolder,
  getTotalFileCount,
  setupAndCheckVaultFolders,
  getFolderPath,
  checkAllFolders,
  hasFiles,
  ensureTrailingSlash,
  getAllFilesAndCount,
};
