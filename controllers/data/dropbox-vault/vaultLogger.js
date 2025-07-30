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
    errorType: null,
    requestSize: null,
  };

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

  if (req.cmapApiCallDetails) {
    req.cmapApiCallDetails.query = JSON.stringify(loggingData);
  }
};

module.exports = {
  logDropboxVaultDownload,
};
