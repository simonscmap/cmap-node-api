const { Parser } = require("node-sql-parser");
const initializeLogger = require("../../log-service");
const log = initializeLogger("router pure");

const parserOptions = {
  database: "transactsql", // a.k.a mssql
};
// HELPERS

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

/* Extract table names from AST
 * :: AST -> [TableName]
 * Note that this function will return an empty array if it fails
 */
const extractTableNamesFromAST = (ast) => {
  if (ast && !ast.tableList) {
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

// string parsing table names from query
const extractTableNamesFromGrammaticalQueryString = (query = "") => {
  return (
    query
      .replace(/'|,|\[|\]/gi, "") // remove ' , [ and ]
      .split(" ") // split on space
      // NOTE with this string parsing, we are relying on the convention
      // that table names begin with "tbl"; this differs from the function
      // above "extractTableNamesFromAST"
      .filter((word) => word.slice(0, 3) === "tbl")
  );
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
  // TODO try both tsql and hive flavors
  const parser = new Parser();
  let result;
  try {
    result = parser.parse(query, parserOptions);
  } catch (e) {
    log.warn("error parsing query", { error: e, query });
    return;
  }
  return result;
};

// given a list of table names, remove any that both
// (a) do not begin with "tbl" and
// (b) do not exist in the provided tableList
const filterRealTables = (names = [], tableList = []) => {
  return names.reduce((validList, nextName) => {
    if (nextName.slice(0, 3) === "tbl") {
      return validList.slice().concat(nextName);
    } else if (tableList.includes(nextName)) {
      return validList.slice().concat(nextName);
    } else {
      return validList;
    }
  }, []);
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

module.exports = {
  transformDatasetServersListToMap,
  extractTableNamesFromAST,
  extractTableNamesFromEXEC,
  extractTableNamesFromGrammaticalQueryString,
  queryToAST,
  removeSQLDashComments,
  removeSQLBlockComments,
  isSproc,
  filterRealTables,
  assertPriority,
};
