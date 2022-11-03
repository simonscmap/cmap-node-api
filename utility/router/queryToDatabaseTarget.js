const initializeLogger = require("../../log-service");
// queries used are stored in ./queries.js
// each is cached without expiration
const {
  fetchAllTablesWithCache,
  fetchDatasetIdsWithCache,
  fetchDatasetLocationsWithCache,
} = require("./queries");
// all helper functions that are pure, i.e., have no side effects,
// are imported from ./pure.js
const {
  filterRealTables,
  assertPriority,
  extractTableNamesFromQuery,
  calculateCandidateTargets,
} = require("./pure");

const log = initializeLogger("queryToDatabaseTarget");

// Execute

const run = async (query) => {
  // 1. parse query and get table names
  let { extractedTableNames, commandType } = extractTableNamesFromQuery(query);

  // 2. get list of all tables
  let tableList = await fetchAllTablesWithCache();

  // 3. filter out any invalid table names
  let tableNames = filterRealTables(extractedTableNames, tableList);

  // 4. get dataset ids from table names
  let datasetIds = await fetchDatasetIdsWithCache();

  // 5. look up locations for dataset ids
  let datasetLocations = await fetchDatasetLocationsWithCache();

  // 6. calculate candidate locations
  let candidateLocations = calculateCandidateTargets(
    tableNames,
    datasetIds,
    datasetLocations
  );

  // TODO send useful error if there is no candidate server for multiple data sets

  // 7. assert priority
  let { prioritizedLocations, priorityTargetType } = assertPriority(
    candidateLocations
  );

  log.info("router result", {
    query,
    commandType,
    candidates: candidateLocations.join(" "),
  });

  // 8. return candidate query targets
  return {
    commandType,
    priorityTargetType,
    candidateLocations: prioritizedLocations,
  };
};

module.exports = {
  getCandidateList: run,
};
