const { Parser } = require("node-sql-parser");
const initializeLogger = require("../../log-service");
const log = initializeLogger("router pure");
const { SERVER_NAMES } = require("../constants");

const toLowerCase = (str = "") => str.toLowerCase();

// parser options: https://github.com/taozhi8833998/node-sql-parser/blob/master/src/parser.all.js
const tsqlParserOptions = {
  database: "transactsql", // a.k.a mssql
};

const hiveParserOptions = {
  database: "hive", // a.k.a sparq
}

// HELPERS

// strip brackets from query
const removeBrackets = (query) =>
  query.replace(/'|,|\[|\]/gi, "");


/* Transform Dasaset_Servers recordset to Map
 * :: [{Dataset_ID, ServerName}] => Map ID [ServerName]
 * create a Map of dataset servers
 * Maps are optimized for frequent read/writes, and safely use the integer of
 * the dataset ID as a key; see:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
 */
const transformDatasetServersListToMap = (recordset) => {
  let map = new Map();

  recordset.forEach(({ Dataset_ID, Server_Alias }) => {
    let existingEntry = map.get(Dataset_ID);
    if (!existingEntry) {
      map.set(Dataset_ID, [Server_Alias]);
    } else {
      map.set(Dataset_ID, [...existingEntry, Server_Alias]);
    }
  });

  return map;
};

/* produce list of core tables, and a list of dataset tables
 * :: [ String tableName ] -> [ { Dataset_Id, Table_Name } ] -> { CoreTables, DatasetTables }
 * - tableList is a list of all tables on prem
 * - datasetList is a list of all datasets (and their ids)
 */
const compareTableAndDatasetLists = (tableList = [], datasetList = []) => {
  let coreTables = tableList
    .filter((tableName) => datasetList
      .some(({ Table_Name }) => Table_Name === tableName));

  let datasetTables = datasetList.map(({ Table_Name }) => Table_Name);

  return {
    coreTables,
    datasetTables,
  };
};


/* Extract table names from AST
 * :: AST -> [TableName]
 * Note that this function will return an empty array if it fails
 */
const extractTableNamesFromAST = (ast) => {
  if (ast && !ast.tableList) {
    log.debug('no tableList in ast');
    return [];
  }
  try {
    let result = ast.tableList.map((tableString) =>
      tableString.split("::").slice(-1).join()
    );
    // NOTE we will no longer filter out names not starting with "tbl"
    // because we want to allow queries that may visit core tables
    //.filter((tableName) => tableName.slice(0, 3) === "tbl");
    return result;
  } catch (e) {
    log.error("error parsing ast", { error: e, ast });
    return [];
  }
};

/* Extract table names from EXEC
 * :: AST -> [TableName]
 * Note that extractTableNamesFromEXEC provides a fallback if no query is
 * provided, in which case it will return an empty array
 */
const extractTableNamesFromEXEC = (query = "") => {
  return query
    .split(" ")
    .map((w) => w.replace(/'|,|\[|\]/gi, "")) // remove all: ' , [ ]
    .filter((w) => w.slice(0, 3) === "tbl"); // return any strings that start with "tbl"
};

/* string parsing table names from query
 * NOTE with this string parsing, we are relying on the convention
 * that table names begin with "tbl"; this differs from the function
 * above "extractTableNamesFromAST"
 */
const extractTableNamesFromGrammaticalQueryString = (query = "") => {
  let q = removeSQLBlockComments(removeSQLDashComments(query));
  return q
    .replace(/'|,|\[|\]/gi, " ") // it is critical that these be replaced by spaces
    .split(" ") //
    .filter((word) => word.slice(0, 3) === "tbl")
    .map((word) => word.replace(/\)/gi, "")) // replace parens
};

// remove sql -- comments, which operate on the rest of the line
const removeSQLDashComments = (query = "") => {
  let stripDashComment = (line) => {
    let indexOfDash = line.indexOf("--");
    if (indexOfDash === -1) {
      return line;
    } else {
      return line.slice(0, indexOfDash);
    }
  };

  let stringHasLength = (line) => line.length > 0;

  let lines = query.split("\n");
  let linesWithoutDashedComments = lines
    .map(stripDashComment)
    .filter(stringHasLength);

  return linesWithoutDashedComments.join("\n");
};

const removeSQLBlockComments = (query = "") => {
  while (query.indexOf("/*") > -1) {
    let openCommentIx = query.indexOf("/*");
    let nextCloseIx = query.indexOf("*/", openCommentIx);
    // its safe to mutate this, because a string arg is copied, not passed by reference
    // note, to strip the whole comment we must account for the character length of the "*/"
    // by adding 2 to the index of the closing comment
    query = [query.slice(0, openCommentIx), query.slice(nextCloseIx + 2)].join(
      ""
    );
  }
  return query;
};

// isSproc -- determine if a query is executing a sproc
const isSproc = (query = "") => {
  let queryWithoutDashedComments = removeSQLDashComments(query);
  let queryWithoutComments = removeSQLBlockComments(queryWithoutDashedComments);
  let containsEXEC = queryWithoutComments.toLowerCase().includes("exec");
  return containsEXEC;
};

/* parse a sql query into an AST
   :: Query -> AST | null
 */
const queryToAST = (query = "") => {
  const parser = new Parser();
  let result = {}
  try {
    result.parserResult = parser.parse(query, tsqlParserOptions);
    result.flavor = tsqlParserOptions.database;
  } catch (e) {
    // if parsing as tsql fails, try as hive
    log.warn("attempt to parse query as tsql failed", { error: e });
    try {
      result.parserResult = parser.parse(query, hiveParserOptions);
      result.flavor = hiveParserOptions.database;
    } catch (e2) {
      log.warn("attempt to parse query an ansi sql failed", { error: e2, query });
      return;
    }
  }
  log.debug("queryToAst result", result);
  return result;
};

// given lists of core and dataset tables, return matching table names
// (also return a list of omitted table names);
const filterRealTables = (names = [], coreTables = [], datasetTables = []) => {
  let matchingCoreTables = coreTables
    .filter((coreTbl) => names.some((name) => name.toLowerCase() === coreTbl.toLowerCase()));
  let matchingDatasetTables = datasetTables
    .filter((dataTbl) => names.some((name) => name.toLowerCase() === dataTbl.toLowerCase()));
  let omittedTables = names.filter((name) => {
    !matchingCoreTables.includes(name) && !matchingDatasetTables.includes(name);
  });
  let noTablesWarning = matchingCoreTables.length === 0 && matchingDatasetTables.length === 0;

  return {
    matchingCoreTables,
    matchingDatasetTables,
    omittedTables,
    noTablesWarning
  };
};

// assert priority
const assertPriority = (candidateLocations) => {
  let includesCluster = candidateLocations.includes("cluster");

  let prioritizedLocations = includesCluster
    ? candidateLocations.filter((loc) => loc !== "cluster").concat("cluster")
    : candidateLocations;

  let priorityTargetType =
    candidateLocations.length === 1 && includesCluster ? "cluster" : "prem";

  return {
    priorityTargetType,
    prioritizedLocations,
  };
};
const { COMMAND_TYPES } = require("../constants");

// ANALYZE QUERY

/* Analyze query and extract names of tables visited by query
 * :: Query -> [TableName]
 * Handle "exec" separately
 * NOTE: parser can handle CTEs, joins, comments
 * see: https://github.com/taozhi8833998/node-sql-parser
 */
const extractTableNamesFromQuery = (query = "") => {
  let commandType = isSproc(query) ? COMMAND_TYPES.sproc : COMMAND_TYPES.custom;

  // Sproc
  if (commandType === COMMAND_TYPES.sproc) {
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
  log.debug("grammatical", { termsFromStringParse });

  let termsFromAST = [];

  let result = queryToAST(query);
  if (!result) {
    log.warn("error parsing query: no resulting ast", { query, result });
  } else {
    let parserResult = result.parserResult;
    if (parserResult && parserResult.ast && parserResult.ast.from) {
      termsFromAST = extractTableNamesFromAST(parserResult);
      log.debug("tables names from AST", {
        query,
        flavor: result.flavor,
        ast: parserResult,
        astTableList: parserResult.tableList,
        tableList: parserResult.tableList,
      });
    }
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
  matchingTables,
  datasetIds,
  datasetLocations
) => {

  let errorMessages = [];

  // 0. check args
  if (matchingTables.noTablesWarning) {
    log.debug("no table names provided", {
      matchingTables
    });
    errorMessages.push('no target tables');
    return [errorMessages, []];
  }


  // 1. get ids of dataset tables named in query
  let { matchingCoreTables, matchingDatasetTables } = matchingTables;
  let targetDatasetIds = datasetIds
    .filter(({ Table_Name }) =>
      matchingDatasetTables
        .map(toLowerCase)
        .includes(Table_Name.toLowerCase())
    )
    .map(({ Dataset_ID }) => Dataset_ID);

  if (targetDatasetIds.length !== matchingDatasetTables.length - matchingCoreTables.length) {
    log.warn('could not match all ids', targetDatasetIds);
  }

  // 2. derrive common targets

  // for each dataset table's id, look up the array of compatible locations
  // :: [ ids ] -> [ [ CompatibleServerNames ] ]
  let locationCandidatesPerTable = targetDatasetIds
    .map((id) => {
      let loc = datasetLocations.get(id);
      if (!loc) {
        log.warn('no target found for dataset id', { id });
      }
      return loc;
    })
    .filter((location) => location);


  // 3. make compatibility calculation
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

  let candidates = new Set();

  if (locationCandidatesPerTable.length) {
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
  }

  let result = Array.from(candidates);

  // 4. factor in core tables

  // if there are no candidate server after comparing dataset tables,
  // and there are core tables named in the query,
  // offer rainier as a candidate,
  if (matchingCoreTables.length && !result.length) {
    result.push(SERVER_NAMES.rainier);
  }

  // return a distribution error if there were dataset tables but no candidate server
  if (matchingDatasetTables.length && result.length === 0) {
    let message = "unable to perform query because datasets named in the query are distributed; " +
                  "you man need to perform your join locally after dowloading the datasets individually";
    errorMessages.push(message);
    log.warn("no candidate servers identified", {
      matchingTables,
      targetDatasetIds,
      locationCandidatesPerTable,
    });

    return [errorMessages, result];
  }

  // if there are core tables named in query,
  // and if there are candidates for dataset tables,
  // but the candidates do not include rainier,
  // return a detailed error message
  // and an empty result array
  if (matchingCoreTables.length && result.length && !result.includes(SERVER_NAMES.rainier)) {
    errorMessages.push(
      'query references core table(s), but also datasets which are not accessible on the same server'
    );
    result = [errorMessages, []];
  }

  // default
  return [errorMessages, result];
};

module.exports = {
  removeBrackets,
  transformDatasetServersListToMap,
  compareTableAndDatasetLists,
  extractTableNamesFromAST,
  extractTableNamesFromEXEC,
  extractTableNamesFromGrammaticalQueryString,
  queryToAST,
  removeSQLDashComments,
  removeSQLBlockComments,
  isSproc,
  filterRealTables,
  assertPriority,
  extractTableNamesFromQuery,
  calculateCandidateTargets,
};
