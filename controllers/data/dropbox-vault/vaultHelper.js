const dbx = require('../../../utility/DropboxVault');
const CHUNK_SIZE = 2000;

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

module.exports = {
  getFilesFromFolder,
  getTotalFileCount,
};
