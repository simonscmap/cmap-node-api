const NodeCache = require('node-cache');

class GenericCache {
  constructor(prefix, ttl = 3600) {
    this.cache = new NodeCache();
    this.prefix = prefix;
    this.ttl = ttl;
  }

  generateKey(identifier) {
    return `${this.prefix}${identifier}`;
  }

  set(identifier, value, log = null) {
    const cacheKey = this.generateKey(identifier);
    const success = this.cache.set(cacheKey, value, this.ttl);
    
    if (log && success) {
      log.info('Cached value', { 
        identifier, 
        cacheKey, 
        ttl: this.ttl 
      });
    }
    
    return success;
  }

  get(identifier, log = null) {
    const cacheKey = this.generateKey(identifier);
    const cachedValue = this.cache.get(cacheKey);
    
    if (cachedValue !== undefined && log) {
      log.info('Retrieved cached value', { 
        identifier, 
        cacheKey 
      });
    }
    
    return cachedValue;
  }

  clear(identifier, log = null) {
    const cacheKey = this.generateKey(identifier);
    const deleted = this.cache.del(cacheKey);
    
    if (log && deleted) {
      log.info('Cleared cached value', { identifier, cacheKey });
    }
    
    return deleted > 0;
  }

  has(identifier) {
    const cacheKey = this.generateKey(identifier);
    return this.cache.has(cacheKey);
  }

  getStats() {
    return this.cache.getStats();
  }
}

module.exports = GenericCache;