const initializeLogger = require("../../log-service");
const log = initializeLogger("queryToDatabaseTarget");
const {
  fetchAllTablesWithCache,
  fetchDatasetIdsWithCache,
  fetchDatasetLocationsWithCache,
} = require("./queries");
const {
  extractTableNamesFromAST,
  extractTableNamesFromEXEC,
  queryToAST,
  isSproc,
  extractTableNamesFromGrammaticalQueryString,
  filterRealTables,
  assertPriority,
} = require("./pure");

// ANALYZE QUERY

/* Analyze query and extract names of tables visited by query
 * :: Query -> [TableName]
 * Handle "exec" separately
 * NOTE: parser can handle CTEs, joins, comments
 * see: https://github.com/taozhi8833998/node-sql-parser
 */
const extractTableNamesFromQuery = (query = "") => {
  let commandType = isSproc(query) ? "sproc" : "custom";
  // Sproc
  if (commandType === "sproc") {
    let tableNames = extractTableNamesFromEXEC(query);
    if (!tableNames.length) {
      log.debug("no tables specified in sproc", { query, tableNames });
    } else {
      log.debug("sproc table names", { tableNames });
    }
    return {
      commandType,
      extractedTableNames: tableNames,
    };
  }

  // Grammatical Query

  let termsFromStringParse = extractTableNamesFromGrammaticalQueryString(query);

  let termsFromAST = [];

  let astResult = queryToAST(query);
  if (astResult && astResult.ast && astResult.ast.from) {
    termsFromAST = extractTableNamesFromAST(astResult);
    log.debug("tables names from AST", {
      query,
      ast: astResult,
      astTableList: astResult.tableList,
      tableList: astResult.tableList,
    });
  } else {
    log.warn("error parsing query: no resulting ast", { query, astResult });
  }

  // reduce results of both parses to a single set of terms
  let terms = new Set();

  termsFromAST.forEach((t) => terms.add(t));
  termsFromStringParse.forEach((t) => terms.add(t));

  return {
    commandType,
    extractedTableNames: Array.from(terms),
  };
};

/*
 *:: [TableName] -> [{Dataset_ID, Table_Name}] -> Map Id [ServerName] -> [ServerName]
 */
const calculateCandidateTargets = (
  tableNames,
  datasetIds,
  datasetLocations
) => {
  // 0. check args
  if (tableNames.length === 0) {
    log.debug("no table names provided", {
      tableNames,
      datasetIds,
      datasetLocations,
    });
    return [];
  }

  // 1. get ids of tables named in query
  let targetIds = datasetIds
    .filter(({ Table_Name }) => tableNames.includes(Table_Name))
    .map(({ Dataset_ID }) => Dataset_ID);

  // 2. derrive common targets

  // -- for each table's id, look up the array of compatible locations
  let locationCandidatesPerTable = targetIds.map((id) =>
    datasetLocations.get(id)
  );

  let candidates = new Set();

  /*
   Working from the first table's array, for each compatible server
   check to see if that server is also compatible for all remaining
   tables (i.e., is present in all compatability arrays).

   NOTE this iteration will work even if the array contains only one
   set of candidate server names, i.e., when only one table is visited
   by the query -- this is ensured by the `slice` returning an empty
   array if there are no more members of the `locationCandidatesPerTable`
   array.
  */
  locationCandidatesPerTable[0].forEach((serverName) => {
    let serverIsCandidateForAllTables = locationCandidatesPerTable
      .slice(1)
      .every((candidateList) => candidateList.includes(serverName));
    if (serverIsCandidateForAllTables) {
      // add to the Set
      // multiple adds of the same name will be discarded by the Set
      candidates.add(serverName);
    }
  });

  let result = Array.from(candidates);

  log.debug("determine candidate servers", {
    // datasetLocations,
    // datasetIds,
    // tableNames,
    candidates: result,
  });

  return result;
};

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
  // helpers:
  isSproc, // re-export
  extractTableNamesFromQuery,
  // main decision-making function:
  calculateCandidateTargets,
  // execution:
  getCandidateList: run,
};
