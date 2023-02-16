const NodeCache = require( "node-cache" );
const logInit = require("../log-service");

// NOTE: no options are passed
// see defaults: https://github.com/node-cache/node-cache#options
// as is, the cache has no key limit, and unlimited TTL
const cache = new NodeCache();

const log = logInit("nodeCache");

// https://github.com/node-cache/node-cache#events
cache.on("expired", (key) => {
  log.info("node cache: expired", { key })
});

cache.on("set", (key) => {
  log.info("node cache: set", { key })
});

cache.on("flush", () => {
  log.info("node cache: flush")
});

module.exports = cache;
