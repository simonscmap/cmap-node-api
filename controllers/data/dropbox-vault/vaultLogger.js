// Logging utilities for dropbox vault operations

// Helper function to log dropbox vault download operations
const logDropboxVaultDownload = (
  req,
  { shortName, datasetId, files, totalFileSize, success = false, error = null },
) => {
  const loggingData = {
    operation: 'dropbox-vault-download',
    shortName,
    datasetId,
    fileCount: files ? files.length : 0,
    totalFileSizeKB: totalFileSize,
    success,
    errorType: null,
    requestSize: null,
  };

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
