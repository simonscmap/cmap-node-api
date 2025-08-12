const cache = require('../../../utility/nodeCache');

// Cache configuration for vault files
const VAULT_CACHE_TTL = 60 * 60; // 1 hour TTL in seconds
const VAULT_CACHE_PREFIX = 'vault_files:';

// Helper function to generate cache key
const generateCacheKey = (path) => {
  return `${VAULT_CACHE_PREFIX}${path}`;
};

// Helper function to set cached vault files
const setCachedVaultFiles = (path, data, log) => {
  const cacheKey = generateCacheKey(path);
  const success = cache.set(cacheKey, data, VAULT_CACHE_TTL);
  if (log && success) {
    log.info('Cached vault files', { 
      path, 
      cacheKey, 
      fileCount: data.totalCount,
      ttl: VAULT_CACHE_TTL 
    });
  }
  return success;
};

// Helper function to get cached vault files
const getCachedVaultFiles = (path, log) => {
  const cacheKey = generateCacheKey(path);
  const cachedData = cache.get(cacheKey);
  
  if (cachedData && log) {
    log.info('Retrieved cached vault files', { 
      path, 
      cacheKey, 
      fileCount: cachedData.totalCount 
    });
  }
  
  return cachedData;
};

// Helper function to clear cache for a specific path
const clearCachedVaultFiles = (path, log) => {
  const cacheKey = generateCacheKey(path);
  const deleted = cache.del(cacheKey);
  if (log && deleted) {
    log.info('Cleared cached vault files', { path, cacheKey });
  }
  return deleted > 0;
};

// Function to retrieve cached vault files data by path
const getVaultFilesByPath = (path, log) => {
  const cachedData = getCachedVaultFiles(path, log);
  if (cachedData) {
    return {
      success: true,
      data: cachedData,
      source: 'cache'
    };
  }
  
  return {
    success: false,
    data: null,
    source: 'cache_miss',
    message: 'No cached data found for path'
  };
};

// Optional cleanup function for cache maintenance
const cleanupVaultCache = (log) => {
  try {
    const allKeys = cache.keys();
    const vaultKeys = allKeys.filter(key => key.startsWith(VAULT_CACHE_PREFIX));
    
    if (vaultKeys.length === 0) {
      if (log) {
        log.info('Cache cleanup: No vault cache entries found');
      }
      return { cleaned: 0, total: 0 };
    }

    // For now, just report what would be cleaned
    // In a full implementation, you might clean based on age, access patterns, etc.
    if (log) {
      log.info('Cache cleanup report', {
        vaultCacheEntries: vaultKeys.length,
        totalCacheEntries: allKeys.length,
        vaultKeys: vaultKeys
      });
    }

    return {
      cleaned: 0,
      total: vaultKeys.length,
      message: 'Cleanup function available but no automatic cleanup performed'
    };
  } catch (error) {
    if (log) {
      log.error('Error during cache cleanup', { error });
    }
    return {
      cleaned: 0,
      total: 0,
      error: error.message
    };
  }
};

module.exports = {
  setCachedVaultFiles,
  getCachedVaultFiles,
  clearCachedVaultFiles,
  getVaultFilesByPath,
  cleanupVaultCache,
};