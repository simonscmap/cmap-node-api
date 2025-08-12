const dbx = require('../../../utility/DropboxVault');
const { 
  setCachedVaultFiles, 
  getCachedVaultFiles
} = require('./vaultCache');
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

// Helper function to check all folders for availability
const checkAllFolders = async (repPath, nrtPath, rawPath, log) => {
  const startTime = Date.now();

  try {
    const results = await Promise.all([
      getFilesFromFolder(repPath, { limit: 1, includeTotal: true }, log),
      getFilesFromFolder(nrtPath, { limit: 1, includeTotal: true }, log),
      getFilesFromFolder(rawPath, { limit: 1, includeTotal: true }, log),
    ]);

    const endTime = Date.now();
    const duration = endTime - startTime;

    const folderAvailability = {
      hasRep: results[0][1] && results[0][1].totalCount > 0,
      hasNrt: results[1][1] && results[1][1].totalCount > 0,
      hasRaw: results[2][1] && results[2][1].totalCount > 0,
    };

    log.info('checkAllFolders performance', {
      duration,
      folderAvailability,
      repCount: results[0][1] ? results[0][1].totalCount : 0,
      nrtCount: results[1][1] ? results[1][1].totalCount : 0,
      rawCount: results[2][1] ? results[2][1].totalCount : 0,
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

// New function: Get ALL files and total count in one traversal (with caching)
const getAllFilesAndCount = async (path, log) => {
  // Check cache first
  const cachedData = getCachedVaultFiles(path, log);
  if (cachedData) {
    return [null, cachedData];
  }

  // Cache miss - fetch from Dropbox
  const [error, data] = await getAllFilesAndCountFromDropbox(path, log);
  
  // Cache the result if successful
  if (!error && data) {
    setCachedVaultFiles(path, data, log);
  }
  
  return [error, data];
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
            include_non_downloadable_files: false
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
  ensureTrailingSlash,
  getAllFilesAndCount,
};
