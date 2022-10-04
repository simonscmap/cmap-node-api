const NodeCache = require( "node-cache" );
const logInit = require("../log-service");

const isDevelopment =
  process.env.NODE_ENV !== "production" || process.env.NODE_ENV !== "staging";

// NOTE: no options are passed
// see defaults: https://github.com/node-cache/node-cache#options
// as is, the cache has no key limit, and unlimited TTL
const cache = new NodeCache();

if (isDevelopment) {
  // log some basic cache usage
  const log = logInit("nodeCache");
  // https://github.com/node-cache/node-cache#events
  cache.on("set", (key) => {
    log.debug("node cache: set", { key })
  });
  cache.on("expired", (key) => {
    log.debug("node cache: set", { key })
  });
}

module.exports = cache;
