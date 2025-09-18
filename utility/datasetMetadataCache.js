const GenericCache = require('./genericCache');

// Specific cache instance for dataset metadata
const DATASET_METADATA_TTL = 60 * 60; // 1 hour
const DATASET_METADATA_PREFIX = 'dataset_metadata:';

const datasetMetadataCache = new GenericCache(DATASET_METADATA_PREFIX, DATASET_METADATA_TTL);

module.exports = {
  setDatasetMetadata: (shortName, metadata, log) => {
    return datasetMetadataCache.set(shortName, metadata, log);
  },
  
  getDatasetMetadata: (shortName, log) => {
    return datasetMetadataCache.get(shortName, log);
  },
  
  clearDatasetMetadata: (shortName, log) => {
    return datasetMetadataCache.clear(shortName, log);
  },
  
  hasDatasetMetadata: (shortName) => {
    return datasetMetadataCache.has(shortName);
  },
  
  getStats: () => {
    return datasetMetadataCache.getStats();
  }
};