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

  // 7. assert priority
  let { prioritizedLocations, priorityTargetType } = assertPriority(
    candidateLocations
  );

  log.info("router result", {
    query,
    commandType,
    tablesIdentified: tableNames || "none",
    candidates: candidateLocations.join(" "),
  });

  // 8. determine if detailed error message is necessary
  let errorMessage = "";
  if (tableNames.length > 1 && candidateLocations.length === 0) {
    errorMessage = "unable to perform query because datasets named in the query are distributed; you man need to perform your query locally after dowloading the constituent datasets";
  }

  // 9. return candidate query targets
  return {
    commandType,
    priorityTargetType,
    candidateLocations: prioritizedLocations,
    errorMessage,
  };
};

module.exports = {
  getCandidateList: run,
};
