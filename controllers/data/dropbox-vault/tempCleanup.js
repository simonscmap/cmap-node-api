// Temporary folder cleanup utilities for Dropbox vault operations
// This module provides functions to clean up temporary download folders
// in a manner that's safe for multiple server instances

const { setTimeout } = require('timers');
const dbx = require('../../../utility/DropboxVault');
const initLog = require('../../../log-service');

const moduleLogger = initLog('controllers/data/dropbox-vault/tempCleanup');

// Enhanced safe deletion function that handles missing folders gracefully
// This is critical for multiple server instances that may schedule cleanup
// for the same folder but only one will actually perform the deletion
const safeDropboxDelete = async (dropbox, path) => {
  const log = moduleLogger;
  // Additional safety check for empty or root paths
  if (!path || path === '/' || path.trim() === '' || path.includes('/vault')) {
    const error = new Error(
      `SAFETY GUARD: Attempted to delete empty, root path, or vault path: ${path}`,
    );
    log.error('BLOCKED DANGEROUS DELETION ATTEMPT', {
      path,
      error: error.message,
    });
    throw error;
  }

  // Only allow deletion of paths within /temp-downloads
  const normalizedPath = path.toLowerCase();
  if (!normalizedPath.startsWith('/temp-downloads/')) {
    const error = new Error(
      `SAFETY GUARD: Attempted to delete path outside /temp-downloads/: ${path}`,
    );
    log.error('BLOCKED DANGEROUS DELETION ATTEMPT', {
      path,
      error: error.message,
    });
    throw error;
  }

  try {
    log.info('Safe deletion proceeding', { path });
    const result = await dropbox.filesDeleteV2({ path });
    log.info('Safe deletion completed successfully', { path });
    return result;
  } catch (error) {
    // Handle "not found" errors gracefully (for multiple server instance support)
    if (
      error.status === 409 &&
      error.error &&
      error.error.error_summary &&
      error.error.error_summary.includes('path_lookup/not_found')
    ) {
      log.info('Folder already deleted by another instance', { path });
      return; // Return success - folder is gone, which is what we wanted
    }

    // Re-throw other errors
    throw error;
  }
};

// Function to get all temp subfolders from /temp-downloads
const getAllTempFolders = async () => {
  const log = moduleLogger;
  try {
    const response = await dbx.filesListFolder({
      path: '/temp-downloads',
      recursive: false,
      include_media_info: false,
      include_deleted: false,
      include_non_downloadable_files: false,
    });

    // Filter to only get folders (not files)
    const folders = response.result.entries
      .filter((entry) => entry['.tag'] === 'folder')
      .map((folder) => folder.path_display);

    log.info('Retrieved temp folder list', {
      folderCount: folders.length,
      folders: folders,
    });

    return folders;
  } catch (error) {
    // Handle case where /temp-downloads doesn't exist yet
    if (
      error.status === 409 &&
      error.error &&
      error.error.error_summary &&
      error.error.error_summary.includes('path/not_found')
    ) {
      log.info('/temp-downloads folder does not exist yet - no cleanup needed');
      return [];
    }

    log.error('Error listing temp folders', { error });
    throw error;
  }
};

// Staggered scheduler that captures folder list and schedules individual deletions
// This prevents rate limiting by spacing deletions 90 seconds apart
const scheduleCleanup = async () => {
  const log = moduleLogger;
  try {
    // Capture snapshot of current temp folders immediately
    const foldersToCleanup = await getAllTempFolders();

    if (foldersToCleanup.length === 0) {
      log.info(
        'No temp folders found at scheduling time - no cleanup scheduled',
      );
      return;
    }

    log.info('Scheduling staggered cleanup for captured temp folders', {
      folderCount: foldersToCleanup.length,
      folders: foldersToCleanup,
    });

    // Schedule each folder deletion at staggered intervals
    const baseDelayMs = 90 * 60 * 1000; // 90 minutes
    foldersToCleanup.forEach((folderPath, index) => {
      const staggerDelayMs = index * 30 * 1000; // 30 seconds per folder
      const totalDelayMs = baseDelayMs + staggerDelayMs;

      setTimeout(async () => {
        try {
          await safeDropboxDelete(dbx, folderPath);
          log.info('Scheduled deletion completed', { folderPath });
        } catch (error) {
          log.error('Scheduled deletion failed', {
            folderPath,
            error: error.message,
          });
        }
      }, totalDelayMs);
    });
  } catch (error) {
    log.error('Error scheduling cleanup', { error: error.message });
    // Don't throw - scheduling failure shouldn't block download responses
  }
};

module.exports = {
  safeDropboxDelete,
  scheduleCleanup,
  getAllTempFolders, // Export for testing/debugging
};
