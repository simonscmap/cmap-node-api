// Temporary folder cleanup utilities for Dropbox vault operations
// This module provides functions to clean up temporary download folders
// in a manner that's safe for multiple server instances

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
    return await dropbox.filesDeleteV2({ path });
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
      folders: folders.slice(0, 5), // Log first 5 for debugging without being verbose
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

// Function to clean up all temp folders (used for startup cleanup)
const cleanupAllTempFolders = async () => {
  const log = moduleLogger;
  try {
    const folders = await getAllTempFolders();
    
    if (folders.length === 0) {
      log.info('No temp folders found to clean up');
      return;
    }

    log.info('Starting cleanup of all temp folders', { folderCount: folders.length });

    let successCount = 0;
    let errorCount = 0;

    // Delete each folder, continuing on errors
    for (const folderPath of folders) {
      try {
        await safeDropboxDelete(dbx, folderPath);
        successCount++;
      } catch (error) {
        errorCount++;
        log.error('Failed to delete temp folder', {
          folderPath,
          error: error.message,
        });
        // Continue processing other folders
      }
    }

    log.info('Completed bulk temp folder cleanup', {
      totalFolders: folders.length,
      successCount,
      errorCount,
    });
    
  } catch (error) {
    log.error('Error in bulk temp folder cleanup', { error: error.message });
    throw error;
  }
};

// Function to clean up only specific temp folders from a pre-captured list
// This is used for scheduled cleanup to prevent premature deletion of newer folders
const cleanupSpecificTempFolders = async (folderList) => {
  const log = moduleLogger;
  if (!folderList || folderList.length === 0) {
    log.info('No specific folders provided for cleanup');
    return;
  }

  log.info('Starting cleanup of specific temp folders', { 
    folderCount: folderList.length,
    folders: folderList.slice(0, 3), // Log first 3 for debugging
  });

  let successCount = 0;
  let errorCount = 0;

  // Delete each folder in the list, continuing on errors
  for (const folderPath of folderList) {
    try {
      await safeDropboxDelete(dbx, folderPath);
      successCount++;
    } catch (error) {
      errorCount++;
      log.error('Failed to delete specific temp folder', {
        folderPath,
        error: error.message,
      });
      // Continue processing other folders
    }
  }

  log.info('Completed specific temp folder cleanup', {
    totalFolders: folderList.length,
    successCount,
    errorCount,
  });
};

// New snapshot-based scheduler that captures folder list at scheduling time
// This prevents premature deletion of folders created after scheduling
const scheduleCleanup = async () => {
  const log = moduleLogger;
  try {
    // Capture snapshot of current temp folders immediately
    const foldersToCleanup = await getAllTempFolders();
    
    if (foldersToCleanup.length === 0) {
      log.info('No temp folders found at scheduling time - no cleanup scheduled');
      return;
    }

    log.info('Scheduled cleanup for captured temp folders', {
      folderCount: foldersToCleanup.length,
      folders: foldersToCleanup.slice(0, 3), // Log first 3 for debugging
    });

    // Schedule cleanup of the captured folders after 90 minutes
    const cleanupDelayMs = 90 * 60 * 1000; // 90 minutes
    setTimeout(async () => {
      try {
        await cleanupSpecificTempFolders(foldersToCleanup);
        log.info('Scheduled cleanup completed successfully', {
          originalFolderCount: foldersToCleanup.length,
        });
      } catch (cleanupError) {
        log.error('Scheduled cleanup failed', {
          originalFolderCount: foldersToCleanup.length,
          error: cleanupError.message,
        });
      }
    }, cleanupDelayMs);
    
  } catch (error) {
    log.error('Error scheduling cleanup', { error: error.message });
    // Don't throw - scheduling failure shouldn't block download responses
  }
};

module.exports = {
  safeDropboxDelete,
  cleanupAllTempFolders,
  cleanupSpecificTempFolders,
  scheduleCleanup,
  getAllTempFolders, // Export for testing/debugging
};