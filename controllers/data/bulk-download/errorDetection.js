const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download-error-detection');

// Detect if an error is related to dataset size limits
// Returns error details for size-related errors, null otherwise
const detectBulkDownloadSizeError = (error, log = moduleLogger) => {
  if (!error) {
    return null;
  }

  log.debug('analyzing error for size-related patterns', {
    code: error.code,
    number: error.number,
    message: error.message,
  });

  // SQL Server memory exhaustion errors
  if (error.code === 'EREQUEST') {
    const errorNum = error.number;
    const message = error.originalError?.info?.message || error.originalError?.message || '';
    
    // Memory resource exhaustion (error 701)
    if (errorNum === 701 && message.includes('insufficient system memory')) {
      log.info('detected SQL Server memory exhaustion error', { errorNum, message });
      return {
        type: 'MEMORY_EXHAUSTED',
        statusCode: 413,
        message: 'Dataset too large for download. Please apply filters to reduce the size.',
      };
    }
    
    // Query memory grant timeout (error 8645)
    if (errorNum === 8645 && message.includes('timeout occurred while waiting for memory')) {
      log.info('detected SQL Server memory timeout error', { errorNum, message });
      return {
        type: 'MEMORY_TIMEOUT', 
        statusCode: 413,
        message: 'Dataset too large for download. Please apply filters to reduce the size.',
      };
    }

    // Row size limits (error 511) - group with size errors
    if (errorNum === 511 && message.includes('Cannot create a row of size')) {
      log.info('detected SQL Server row size limit error', { errorNum, message });
      return {
        type: 'ROW_SIZE_LIMIT',
        statusCode: 413,
        message: 'Dataset too large for download. Please apply filters to reduce the size.',
      };
    }
  }
  
  // File system space exhaustion - also treat as size error with 413
  if (error.code === 'ENOSPC') {
    log.info('detected disk space exhaustion error', { code: error.code });
    return {
      type: 'DISK_FULL',
      statusCode: 413,
      message: 'Dataset too large for download. Please apply filters to reduce the size.',
    };
  }
  
  // Connection lost during large transfers - could indicate size issues
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    const message = error.message || '';
    // Only treat as size error if it seems related to large data transfer
    if (message.includes('read ECONNRESET') || message.includes('Timeout: Request failed')) {
      log.info('detected connection error during large transfer', { code: error.code, message });
      return {
        type: 'CONNECTION_LOST_LARGE_TRANSFER',
        statusCode: 413,
        message: 'Dataset too large for download. Please apply filters to reduce the size.',
      };
    }
  }
  
  log.debug('error not identified as size-related', { code: error.code, number: error.number });
  return null; // Not a recognized size-related error
};

module.exports = {
  detectBulkDownloadSizeError,
};