const logDropboxVaultDownload = (
  req,
  { shortName, datasetId, files, totalSize, success = false, error = null },
) => {
  const loggingData = {
    operation: 'dropbox-vault-download',
    shortName,
    datasetId,
    fileCount: files ? files.length : 0,
    totalSize,
    success,
    requestSize: null,
  };

  if (error) {
    const truncatedStack = error.stack ? error.stack.substring(0, 2000) : null;

    loggingData.error = {
      message: error.message || 'Unknown error',
      stack: truncatedStack,
      status: error.status || null,
      type:
        error.status === 400
          ? 'validation'
          : error.status === 429
          ? 'rate_limit'
          : error.status === 507
          ? 'storage'
          : 'system',
    };
  }

  if (req.cmapApiCallDetails) {
    req.cmapApiCallDetails.query = JSON.stringify(loggingData);
  }
};

module.exports = {
  logDropboxVaultDownload,
};
