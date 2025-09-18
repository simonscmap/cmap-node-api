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

module.exports = {
  setCachedVaultCount,
  getCachedVaultCount,
};
