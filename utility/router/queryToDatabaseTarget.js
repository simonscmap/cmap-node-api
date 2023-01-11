const initializeLogger = require("../../log-service");
// queries used are stored in ./queries.js
// each is cached without expiration
const {
  fetchAllOnPremTablesWithCache,
  fetchDatasetIdsWithCache,
  fetchDatasetLocationsWithCache,
} = require("./queries");
// all helper functions that are pure, i.e., have no side effects,
// are imported from ./pure.js
const {
  compareTableAndDatasetLists,
  filterRealTables,
  assertPriority,
  extractTableNamesFromQuery,
  calculateCandidateTargets,
} = require("./pure");

const log = initializeLogger("queryToDatabaseTarget");

// Execute

const run = async (query) => {
  // 1. parse query and get table names
  let queryAnalysis = extractTableNamesFromQuery(query);

  // 2. get list of all tables
  let onPremTableList = await fetchAllOnPremTablesWithCache();

  // 3. get dataset ids from table names
  let datasetIds = await fetchDatasetIdsWithCache();

  // TODO: extract all fetches and this comparison function to a cached result
  let { coreTables, datasetTables } = compareTableAndDatasetLists(onPremTableList, datasetIds);

  // 4. match table names in query to core & data tables
  let matchingTables = filterRealTables(queryAnalysis, coreTables, datasetTables);

  // 5. look up locations for dataset ids
  let datasetLocations = await fetchDatasetLocationsWithCache();

  // 6. calculate candidate locations
  let [errors, candidateLocations] = calculateCandidateTargets(
    matchingTables,
    datasetIds,
    datasetLocations
  );

  // 7. assert priority
  let { prioritizedLocations, priorityTargetType } = assertPriority(
    candidateLocations
  );

  log.info("router result", {
    query,
    commandType: queryAnalysis.commandType,
    namedTables: queryAnalysis.extractedTableNames,
    coreTablesIdentified: matchingTables.matchingCoreTables,
    datasetTablesIdentified: matchingTables.matchingDatasetTables,
    omittedTables: matchingTables.omittedTables,
    candidates: candidateLocations.join(" "),
    errorMessages: errors,
  });

  // 8. return candidate query targets
  return {
    commandType: queryAnalysis.commandType,
    priorityTargetType,
    candidateLocations: prioritizedLocations,
    errorMessage: errors,
  };
};

module.exports = {
  getCandidateList: run,
};
