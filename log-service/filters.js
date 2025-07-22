const removeNodeCacheLogs = (log) => log.context.module !== 'nodeCache';

const removeCacheAsyncTraces = (log) =>
  log.context.module !== 'cacheAsync' && log.level !== 5;

const allDevelopmentFilters = [removeNodeCacheLogs, removeCacheAsyncTraces];

const filterLogsForDevelopment = (log) => {
  const filterResults = allDevelopmentFilters.map((fn) => fn(log));
  return filterResults.every((result) => result); // all filters must return true
};

module.exports = filterLogsForDevelopment;
