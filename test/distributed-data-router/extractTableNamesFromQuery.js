const test = require("ava");
const {
  extractTableNamesFromQuery,
} = require("../../utility/router/pure");

const { records } = require("../fixtures/sample-queries");

test("extracts expected list of table names from sample queries", (t) => {
  records.forEach(([query, expectedCommandType, expectedTables]) => {
    let { commandType, extractedTableNames } = extractTableNamesFromQuery(query);
    t.deepEqual(commandType, expectedCommandType);
    t.deepEqual(extractedTableNames, expectedTables);
  });
});
