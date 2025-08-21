const cache = require('../../../utility/nodeCache');
// TBD implement using utility/genericCache.js

// Cache configuration for vault file count
const VAULT_CACHE_TTL = 60 * 60; // 1 hour TTL in seconds
const VAULT_CACHE_PREFIX = 'vault_count:';

// Helper function to generate cache key
const generateCacheKey = (path) => {
  return `${VAULT_CACHE_PREFIX}${path}`;
};

// Helper function to set cached vault file count
const setCachedVaultCount = (path, totalCount, log) => {
  const cacheKey = generateCacheKey(path);
  const success = cache.set(cacheKey, totalCount, VAULT_CACHE_TTL);
  if (log && success) {
    log.info('Cached vault file count', {
      path,
      cacheKey,
      fileCount: totalCount,
      ttl: VAULT_CACHE_TTL,
    });
  }
  return success;
};

// Helper function to get cached vault file count
const getCachedVaultCount = (path, log) => {
  const cacheKey = generateCacheKey(path);
  const cachedCount = cache.get(cacheKey);

  if (cachedCount !== undefined && log) {
    log.info('Retrieved cached vault file count', {
      path,
      cacheKey,
      fileCount: cachedCount,
    });
  }

  return cachedCount;
};

// Helper function to clear cache for a specific path
const clearCachedVaultCount = (path, log) => {
  const cacheKey = generateCacheKey(path);
  const deleted = cache.del(cacheKey);
  if (log && deleted) {
    log.info('Cleared cached vault file count', { path, cacheKey });
  }
  return deleted > 0;
};

// Function to retrieve cached vault file count by path
const getVaultCountByPath = (path, log) => {
  const cachedCount = getCachedVaultCount(path, log);
  if (cachedCount !== undefined) {
    return {
      success: true,
      count: cachedCount,
      source: 'cache',
    };
  }

  return {
    success: false,
    count: null,
    source: 'cache_miss',
    message: 'No cached count found for path',
  };
};

// Optional cleanup function for cache maintenance
const cleanupVaultCache = (log) => {
  try {
    const allKeys = cache.keys();
    const vaultKeys = allKeys.filter((key) =>
      key.startsWith(VAULT_CACHE_PREFIX),
    );

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
        vaultKeys: vaultKeys,
      });
    }

    return {
      cleaned: 0,
      total: vaultKeys.length,
      message: 'Cleanup function available but no automatic cleanup performed',
    };
  } catch (error) {
    if (log) {
      log.error('Error during cache cleanup', { error });
    }
    return {
      cleaned: 0,
      total: 0,
      error: error.message,
    };
  }
};

module.exports = {
  setCachedVaultCount,
  getCachedVaultCount,
  clearCachedVaultCount,
  getVaultCountByPath,
  cleanupVaultCache,
};
