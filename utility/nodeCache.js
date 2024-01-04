const NodeCache = require( "node-cache" );
const logInit = require("../log-service");

// NOTE: no options are passed
// see defaults: https://github.com/node-cache/node-cache#options
// as is, the cache has no key limit, and unlimited TTL
const cache = new NodeCache();

const log = logInit("nodeCache");

// https://github.com/node-cache/node-cache#events


cache.on("set", (key) => {
  log.info("node cache: set", { key })
});

cache.on("flush", () => {
  log.info("node cache: flush")
});

// report cache state every 15 min
setInterval (() => {
  log.info ('cache state', {
    keys: cache.keys (),
    stats: cache.getStats(),
  });
}, 1000 * 60 * 15);

// NOTE other methods:
// cache.del('key')
// cache.del(['key1','key2'])
// cache.flushAll();
// cache.getStats();

module.exports = cache;
