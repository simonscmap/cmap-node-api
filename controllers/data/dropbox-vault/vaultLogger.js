// Logging utilities for dropbox vault operations

// Helper function to log dropbox vault download operations
const logDropboxVaultDownload = (
  req,
  { shortName, datasetId, files, success = false, error = null },
) => {
  const loggingData = {
    operation: 'dropbox-vault-download',
    shortName,
    datasetId,
    fileCount: files ? files.length : 0,
    totalFileSizeKB: 0,
    success,
    errorType: null,
    requestSize: null,
  };

  // Calculate total file size in KB from file metadata
  if (files && files.length > 0) {
    loggingData.totalFileSizeKB = files.reduce((total, file) => {
      return total + (file.size ? Math.ceil(file.size / 1024) : 0);
    }, 0);
  }

  // Set error type if error occurred
  if (error) {
    loggingData.errorType =
      error.status === 400
        ? 'validation'
        : error.status === 429
        ? 'rate_limit'
        : error.status === 507
        ? 'storage'
        : 'system';
  }

  // Log synchronously
  req.cmapApiCallDetails.query = JSON.stringify(loggingData);
};

module.exports = {
  logDropboxVaultDownload,
};