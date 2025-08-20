const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download-shared');
const { validateRequest } = require('./requestValidation');
const { parseFiltersToConstraints } = require('./dataFetchHelpers');
const { fetchAndPrepareDatasetMetadata } = require('../../catalog');

/**
 * Handles shared pre-query logic: validation, filter processing, metadata fetching
 * @param {Object} req - Express request object  
 * @param {string} reqId - Request ID for logging
 * @returns {Object} Processing result with validation, constraints, and metadata
 */
const processPreQueryLogic = async (req, reqId) => {
  const log = moduleLogger.setReqId(reqId);
  
  // 1. Shared validation
  const validation = validateRequest(req, log);
  if (!validation.isValid) {
    return { success: false, validation };
  }
  
  const { shortNames, filters } = validation;
  
  // 2. Transform filters to constraints  
  const constraints = parseFiltersToConstraints(filters);
  
  // 3. Fetch metadata for all datasets
  const datasetPromises = shortNames.map(async (shortName) => {
    const [metadataErr, metadata] = await fetchAndPrepareDatasetMetadata(shortName, reqId);
    if (metadataErr) {
      throw new Error(`Could not find dataset: ${shortName}`);
    }
    
    return { shortName, metadata };
  });
  
  const datasets = await Promise.all(datasetPromises);
  
  return { 
    success: true,
    validation, // Include original validation object for bulkDownloadController
    shortNames,
    constraints, 
    datasets 
  };
};

module.exports = {
  processPreQueryLogic
};