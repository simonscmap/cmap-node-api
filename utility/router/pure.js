const { Parser } = require("node-sql-parser");
const initializeLogger = require("../../log-service");
const log = initializeLogger("router pure");
const { SERVER_NAMES } = require("../constants");

const toLowerCase = (str = "") => str.toLowerCase();

// return a string name representing the data type
// differentiate between arrays and objects and nulls
const tagType = (arg) => {
  let typeOfArg = typeof arg;

  if (typeOfArg === 'object') {
    if (Array.isArray (arg)) {
      return 'array';
    }

    if (arg === null) {
      return 'null';
    }
  }

  return typeOfArg;
}

// parser options: https://github.com/taozhi8833998/node-sql-parser/blob/master/src/parser.all.js
const tsqlParserOptions = {
  database: "transactsql", // a.k.a mssql
};

const hiveParserOptions = {
  database: "hive", // a.k.a spark
}

const locationIncompatibilityMessage =
  "unable to perform query because datasets named in the query are distributed; " +
  "you may need to perform your join locally after dowloading the datasets individually";

// HELPERS

const normalizeQueryString = (query = "") =>
  [query].map(removeSQLDashComments)
    .map(removeSQLBlockComments)
    //.map(s => s.toLowerCase())
    .map(s => s.trim())
    .shift()


// strip brackets from query
const removeBrackets = (query) =>
  query.replace(/\[|\]/gi, "");

const replaceSTDEV = (query) =>
  query.replace(/STDEV/gi, "STDDEV");

const removeDbo = (query) => {
  let normalizedQuery = normalizeQueryString (query);

  let queryWords = normalizedQuery
    .split(' ')
    .filter(word => word.length > 0);

  // assume that remove dbo runs AFTER removing brackets
  // otherwise this check for index will not work
  let stripDbo = (word) => {
    if (word.toLowerCase().indexOf('dbo.') === 0) {
      return query.replace(/dbo\./gi, "");
    }
    return word;
  }

  return queryWords.map (stripDbo).join (' ');
};

/*
   An AST generated from a SQL query by the node-sql-parser package
   will produce an object with keys 'top' and 'limit' (and the same
   for nested 'expr' objects).

   The 'top' property is an object with 'value' and 'percent' props.

     "top": {
       "value": 100,
       "percent": null
     }

   The 'limit' property is an object with props 'separator' and 'value',
   where 'value' is an object with props 'type' and 'value'.

   Separator will be "offset" if offset is used, such as in:

   -- SELECT * FROM MyTable LIMIT 1 OFFSET 4

   Or "," if two limits are set, such as

   -- SELECT * FROM MyTable LIMIT 1, 2

    "limit": {
      "seperator": "",
      "value": [
        {
          "type": "number",
          "value": 100000
        }
      ]
    }

 */

// :: -> [Error, Limit, Message?]
const topToLimit = (top) => {
  if (top.percent !== null) {
    return [true, 'top uses percent'];
  } else {
    return [false, {
      separator: "",
      value: [
        {
          type: "number",
          value: top.value,
        }
      ],
    }];
  }
};

// :: -> [Error, Obj]
const traverseAST = (obj) => {
  let argType = tagType (obj);
  let error = false;
  let msg = '';
  let result = obj;

  // console.log (argType);

  if (argType === 'object') {

    let entries = Object.entries(obj).reduce((acc, entry) => {
      // don't continue with reduce if there has been an error
      // while trying to convert TOP to LIMIT
      if (error) {
        return acc;
      }

      let [key, value] = entry;
      let t = tagType(value);
      let replacements = [];

      if (key === 'top' && value !== null) {
        let [e, result] = topToLimit(value);
        if (e) {
          error = true;
          msg += 'error while attempting to convert a TOP to a LIMIT' + result;
          return acc; // break out of any further recursion
        }
        replacements.push(['top', null]);
        replacements.push(['limit', result]);
      } else if (key === 'limit') {
        // do nothing so that replacements will be an empty list
        // which prevents and previously injectet 'limit' entry
        // from being overwritten by a null
      } else if (t === 'object' || t === 'array') {
        let [e, traversedValue, m] = traverseAST (value);
        if (e) {
          error = true;
          msg += m;
          return acc;
        }
        replacements.push([key, traversedValue]);
      } else {
        replacements.push(entry);
      }

      return [...acc, ...replacements];
    }, []);

    result = Object.fromEntries (entries);
  } else if (argType === 'array') {
    result = obj.map ((value) => {
      let entryType = tagType (value);
      if (entryType === 'object' || entryType === 'array') {
        let [e, traversedValue, m] = traverseAST (value);
        if (e) {
          error = true;
          msg += m;
          return value;
        }
        return traversedValue;
      } else {
        return value;
      }
    })
  }

  if (error) {
    return [true, null, msg];
  } else {
    return [false, result];
  }
};

let removeBackticks = (s) => s.replace(/`/gi, "");
let removeParensFromTop = (s) => s.replace(/TOP\s*\(?\s*(\d+)\s*\)?/gi, "TOP $1");

// :: QueryString -> [Error, AST, Message?]
let parse = (s) => {
  let parser = new Parser ();
  let result;
  try {
    result = parser.astify (s, { database: 'transactsql' });
  } catch (e) {
    return [true, null, e.message];
  }

  return [false, result];
}

// :: AST -> [Error, QueryString, Message?]
let sqlify = (ast) => {
  let opt = {
    database: 'hive'
  }
  let parser = new Parser()
  let sql;
  let error = false;
  let msg;
  try {
    sql = parser.sqlify(ast, opt);
  } catch (e) {
    error = true;
    msg = e.message
  }
  return [error, sql, msg];
}

// :: QueryString -> [Error, QueryString, Message?]
let transformTopQueryToLimit = (q) => {
  let [e, ast] = [q]
    .map (removeBackticks)
    .map (removeParensFromTop)
    .map (parse)
    .shift();

  if (e) {
    return [true, null, 'AST Parse Error: ' + e];
  }

  let [e2, newAst] = traverseAST (ast);

  if (e2) {
    return [true, null, 'Traverse Error: ' + e2];
  }

  let [e3, newSql] = sqlify (newAst);

  if (e3) {
    return [true, null, 'Sqlify Error: ' + newSql];
  }

  let result = [newSql]
    .map (removeBackticks)
    .shift();

  return [false, result];
};

// NOTE: unfortunately this uses a logger without requestId context
// NOTE: the tsqlToHiveTransfroms in a straight pipeline without an
// error path, thus we just log; it would be a good candidate for
// using a Either with Map
const applyTopTransform = (q) => {
  const re = new RegExp(/TOP\s*\(?\s*\d+\s*\)?/, "gi");
  let match = re.exec (q);
  // apply the transform if there is a TOP expression
  if (match) {
    let [e, result, eMsg] = transformTopQueryToLimit (q);
    if (e) {
      // if there is an error, just return the original query
      log.warn ('error while attempting to replace TOP with LIMIT',
                { query: q, erorr: eMsg});
      return q;
    } else {
      log.info ('replaced TOP with LIMIT', { originalQuery: q, result});
      return result;
    }
  }
  log.debug ('no match for TOP expression', { query: q });
  return q;
}

const tsqlToHiveTransforms = (query) =>
  [query].map (removeBrackets)
         .map (replaceSTDEV)
         .map (removeDbo)
         .map (applyTopTransform)
         .shift ()

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
  // core tables are tables that exist on prem, but are not in the dataset list
  let coreTables = tableList
    .filter(({ Table_Name: onPremTbl }) => !datasetList
      .some(({ Table_Name: dataTbl }) => onPremTbl.toLowerCase() === dataTbl.toLowerCase())
    )
    .map(({ Table_Name }) => Table_Name);


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
  let allSingleQuotesCommasBrackets = new RegExp(/'|,|\[|\]/gi);
  let replaceAllSingleQuotesCommasBrackets = (replacementString) => (target) =>
  target.replace(allSingleQuotesCommasBrackets, replacementString);

  return query
    .split(" ")
    .map(replaceAllSingleQuotesCommasBrackets ("")) // remove all: ' , [ ]
    .filter((w) => w.slice(0, 3) === "tbl"); // return any strings that start with "tbl"
};

/* String parsing table names from query
 * NOTE with this string parsing, we are relying on the convention
 * that table names begin with "tbl"; this differs from the function
 * above "extractTableNamesFromAST"
 */
const extractTableNamesFromGrammaticalQueryString = (query = "") => {
  // Note that replacing single quotes with spaces and then splitting on spaces
  // will incorrectly extract string literals (such as arguments to functions) as tables;
  // we handle the behavior consequences of this elsewhere

  let allSingleQuotesCommasBracketsNewlinesReturnsTabs = new RegExp(/'|,|\[|\]|\n|\r|\t/gi);
  let replaceBothersomePunctuation = (replacementString) => (target) =>
    target.replace(allSingleQuotesCommasBracketsNewlinesReturnsTabs, replacementString);

  // this IS case sensitive, and depends on the convention that table names
  // start with "tbl"
  let isTableName = (word) => word.slice(0, 3) === "tbl";

  let terminatingParen = new RegExp(/\)\B/);
  let removeTerminatingParen = (word) => word.replace(terminatingParen, "");

  let splitOnSpaces = (s) => s.split(" ");

  // '|,|\[|\]|\n|\r|\t

  return [query]
    .map (removeSQLDashComments)
    .map (removeSQLBlockComments)
    .map (replaceBothersomePunctuation (" "))
    .map (splitOnSpaces)
    .flat () // here we end up with an array within the containing array, so flatten them
    .filter (isTableName)
    .map (removeTerminatingParen) // a tableName could come at the end of a subquey or parenthesized expression
};

// Remove SQL "--" comments, which operate on the rest of the line
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
  let normalizedQuery = [query].map (removeSQLDashComments)
                               .map (removeSQLBlockComments)
                               .map (s => s.toLowerCase())
                               .map (s => s.trim())
                               .shift()

  let [commandTerm, spName] = normalizedQuery
    .split (' ')
    .filter(word => word.length > 0);

  let beginsWith = (str) => (qString) => qString.indexOf (str) === 0;
  let beginsWithExec = beginsWith ('exec');
  let beginsWithExecute = beginsWith ('execute');
  let startsWithExecKeyword = (word) => beginsWithExec (word) || beginsWithExecute (word);

  if (!commandTerm || !startsWithExecKeyword (commandTerm)) {
    return false;
  }

  // at this point we know it starts with exec or execute
  let beginsWithUsp = beginsWith ('usp');
  if (!spName || !beginsWithUsp (spName)) {
    return false;
  }

  return true;
};

const extractSprocName = (query = "") => {
  let normalizedQuery = [query].map(removeSQLDashComments)
    .map(removeSQLBlockComments)
    .map(s => s.toLowerCase())
    .map(s => s.trim())
    .shift()

  if (normalizedQuery.length < 2) {
    log.warn ('expected sproc to have name', { query });
    return '';
  }

  let [, spName] = normalizedQuery
    .split(' ')
    .filter(word => word.length > 0);

  return spName;
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
    log.warn("attempt to parse query as tsql failed", { error: e, query });
    try {
      result.parserResult = parser.parse(removeBrackets(query), hiveParserOptions);
      result.flavor = hiveParserOptions.database;
    } catch (e2) {
      log.warn("attempt to parse query as ansi sql failed", { error: e2, query });
      return;
    }
  }
  log.debug("queryToAst result", result);
  return result;
};

// given lists of core and dataset tables, return matching table names
// as well as data on omitted tables, and flags for no table references
const filterRealTables = (queryAnalysis, coreTables = [], datasetTables = []) => {
  let { extractedPrimaryTableNames: names, extractedTableNames = [] } = queryAnalysis;

  // core tables that are referenced by the query
  let matchingCoreTables = coreTables
    .filter((coreTbl) =>
      names.some((name) => name.toLowerCase() === coreTbl.toLowerCase()));

  // dataset tables that are referenced by the query
  let matchingDatasetTables = datasetTables
    .filter((dataTbl) =>
      names.some((name) => name.toLowerCase() === dataTbl.toLowerCase()));

  // tables that are named but do not match any core or dataset table
  let omittedTables = names
    .filter((name) =>
      !matchingCoreTables.includes(name) && !matchingDatasetTables.includes(name));

  // no REAL tables are referenced by the query
  let noTablesWarning = matchingCoreTables.length === 0 && matchingDatasetTables.length === 0;

  // the query contains no table references at all
  // NOTE this flag relies on the result of the query's parsed AST
  let noTablesNamed = extractedTableNames.length === 0;

  return {
    matchingCoreTables,
    matchingDatasetTables,
    omittedTables,
    noTablesWarning,
    noTablesNamed,
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
 * :: Query -> {
 *      commandType: sproc | custom,
 *      extractedTableNames: [TableName],
 *      extractedPrimaryTableNames: [TableName],
 *    }
 * Handle "exec" separately
 * NOTE: parser can handle CTEs, joins, comments
 * see: https://github.com/taozhi8833998/node-sql-parser
 * NOTE: this uses both the parser library, and custom string parsing
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
      extractedPrimaryTableNames: tableNames,
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
    extractedPrimaryTableNames: termsFromStringParse,
  };
};

/*
 *:: [TableName] -> [{Dataset_ID, Table_Name}] -> Map Id [ServerName] -> [ServerName]
 */
const calculateCandidateTargets = (matchingTables, datasetIds, datasetLocations) => {
  let {
    matchingCoreTables,
    matchingDatasetTables,
    omittedTables,
    noTablesWarning,
    noTablesNamed,
  } = matchingTables;

  let errors = []; // these will cause a 400 response
  let warnings = [];
  let respondWithErrorMessage;

  // 0. check args
  if (noTablesNamed) {
    // this check prevents some valid queries, like "SELECT 1 + 1"
    // but also keeps nonsense queries from reaching the database layer
    errors.push(['no tables were referenced in the query', { matchingTables }]);
    return { errors, candidateLocations: []};
  } else if (omittedTables && omittedTables.length) {
    // NOTE that omitted tables is the result of comparing the list of primary tables (that is,
    // the list of table names identified in the query excluding aliases) to the lists
    // of core and dataset tables
    // NOTE that we do NOT want to return an error in this case
    // because we want it would provide a user with a litmus test for the existence of a table
    // including core tables
    warnings.push (['tables named in the query do not exist', { matchingTables }]);
  }

  // 1. get ids of dataset tables named in query
  let targetDatasets = datasetIds
    .filter(({ Table_Name }) =>
      matchingDatasetTables
        .map(toLowerCase)
        .includes(Table_Name.toLowerCase())
    );

  let targetDatasetIds = targetDatasets
    .map(({ Dataset_ID }) => Dataset_ID);


  if (targetDatasetIds.length !== matchingDatasetTables.length - matchingCoreTables.length) {
    warnings.push([
      'could not match all ids',
      { targetDatasetIds, matchingDatasetTables, matchingCoreTables }
    ]);
  }

  // 2. derrive common targets

  // for each dataset table's id, look up the array of compatible locations
  // :: [ ids ] -> [ [ CompatibleServerNames ] ]
  let locationCandidatesPerTable = targetDatasetIds
    .map((id) => {
      let loc = datasetLocations.get(id);
      if (!loc) {
        warnings.push (['no target found for dataset id', { id }]);
      }
      return loc;
    })
    .filter((location) => location);


  log.trace("target datasets with locations", targetDatasets.map((dataset) => ({
    ...dataset,
    locations: [].concat(datasetLocations.get(dataset.Dataset_ID)).join(' '),
  })));


  /* 3. factor in core tables

     if there is a core table named in the query,
     it won't be represented in the list of dataset table locations;
     force the execution to be run on rainier, on the assumption that
     core tables are only needed for fetching metadata, which is on rainier,
     and never on a cluster */

  if (matchingCoreTables.length > 0) {
    warnings.push(['matched a core table, forcing rainier', { matchingCoreTables }])
    locationCandidatesPerTable = [[SERVER_NAMES.rainier]]
  }

  /* 4. make compatibility calculation

   Working from the first table's array, for each compatible server
   check to see if that server is also compatible for all remaining
   tables (i.e., is present in all compatability arrays).

   NOTE this iteration will work even if the array contains only one
   set of candidate server names, i.e., when only one table is visited
   by the query -- this is ensured by the `slice` returning an empty
   array if there are no more members of the `locationCandidatesPerTable`
   array.  */

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

  // return a distribution error if there were dataset tables but no candidate server
  if (!noTablesWarning && result.length === 0) {
    respondWithErrorMessage = locationIncompatibilityMessage;
    warnings.push([
      "no candidate servers identified",
      {
        matchingTables,
        targetDatasetIds,
        locationCandidatesPerTable,
      }
    ]);

    return {
      errors,
      warnings,
      respondWithErrorMessage,
      candidateLocations: result,
    };
  }

  // default
  return {
    errors,
    warnings,
    respondWithErrorMessage,
    candidateLocations: result,
  };
};

module.exports = {
  locationIncompatibilityMessage,
  removeBrackets,
  replaceSTDEV,
  traverseAST,
  removeParensFromTop,
  transformTopQueryToLimit,
  tsqlToHiveTransforms,
  transformDatasetServersListToMap,
  compareTableAndDatasetLists,
  extractTableNamesFromAST,
  extractTableNamesFromEXEC,
  extractTableNamesFromGrammaticalQueryString,
  queryToAST,
  removeSQLDashComments,
  removeSQLBlockComments,
  isSproc,
  extractSprocName,
  filterRealTables,
  assertPriority,
  extractTableNamesFromQuery,
  calculateCandidateTargets,
};
