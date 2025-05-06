// queries with caching
const { fetchDatasetLocationsWithCache } = require('./queries');

// helper functions with no side effects
const { assertPriority, calculateCandidateTargets } = require('./pure');

// Middleware
const routerMiddleware = async (req, res, next) => {
  let {
    modifiedQuery: query, // see earlier middleware in the chain
    queryAnalysis,
    datasetIds,
    coreTables,
    matchingTables,
  } = req;

  let datasetLocations = await fetchDatasetLocationsWithCache();

  // calculate candidate locations
  let { errors, warnings, respondWithErrorMessage, candidateLocations } =
    calculateCandidateTargets(
      matchingTables,
      datasetIds,
      datasetLocations,
      coreTables,
      queryAnalysis,
    );

  // assert priority
  let { prioritizedLocations, priorityTargetType } =
    assertPriority(candidateLocations);

  let messages = [
    [
      'router result',
      {
        query,
        commandType: queryAnalysis.commandType,
        namedTables: queryAnalysis.extractedTableNames,
        coreTablesIdentified: matchingTables.matchingCoreTables,
        datasetTablesIdentified: matchingTables.matchingDatasetTables,
        omittedTables: matchingTables.omittedTables,
        candidates: candidateLocations.join(' '),
        errorMessages: errors,
      },
    ],
  ];

  // execute
  req.candidateListResults = {
    commandType: queryAnalysis.commandType,
    priorityTargetType,
    candidateLocations: prioritizedLocations,
    errorMessage: errors,
    messages,
    errors,
    respondWithErrorMessage,
    warnings,
  };

  next();
};

module.exports = routerMiddleware;
