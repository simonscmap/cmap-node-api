const test = require("ava");
const {
  extractTableNamesFromQuery,
  extractTableNamesFromAST,
  transformDatasetServersListToMap,
  queryToAST,
  calculateCandidateTargets,
} = require("../../utility/queryToDatabaseTarget");
const { pairs } = require("../fixtures/sample-queries");

test("extractTableNamesFromQuery", (t) => {
  pairs.forEach(([query, expected]) => {
    let result = extractTableNamesFromQuery(query);
    t.deepEqual(result, expected);
  });
});

test("transformDatasetServersListToMap", (t) => {
  let recordset = [
    { Dataset_ID: 1, Server_Alias: "rossby" },
    { Dataset_ID: 8, Server_Alias: "mariana" },
    { Dataset_ID: 8, Server_Alias: "ranier" },
    { Dataset_ID: 8, Server_Alias: "rossby" },
  ];

  let r = transformDatasetServersListToMap(recordset);

  // key with one server target
  t.is(r.get(1).length, 1);
  t.deepEqual(r.get(1), ["rossby"]);

  // key with no info
  t.is(r.get(0), undefined);

  // check values stored in Map under the key 8
  let mg8 = r.get(8);
  t.is(mg8.length, 3);
  t.truthy(["rossby", "ranier", "mariana"].every((n) => mg8.includes(n)));
});

test("extractTableNamesFromAST", (t) => {
  // parse a simple query
  let q = "select * from myTable";
  let ast = queryToAST(q);
  let r = extractTableNamesFromAST(ast);
  t.deepEqual(r, ["myTable"]);

  // parse an empty query
  // NOTE: extractTableNamesFromAST will get [] for an AST
  // and will swallow an error trying to access the prop it wants
  let ast2 = queryToAST("");
  let r2 = extractTableNamesFromAST(ast2);
  t.deepEqual(r2, []);
});

test("calculateCandidateTargets: success (single candidate)", (t) => {
  let tableNames = ["table1", "table2"];
  let datasetIds = [
    { Dataset_ID: 8, Table_Name: "table1" },
    { Dataset_ID: 9, Table_Name: "table2" },
  ];
  let dl = new Map(); // dataset locations map
  dl.set(8, ["server1"]);
  dl.set(9, ["server2", "server1"]);

  let result = calculateCandidateTargets(
    tableNames,
    datasetIds,
    dl,
  );

  let expected = ['server1'];
  t.truthy(expected.every((t) => result.includes(t)));
});

test("calculateCandidateTargets: success (multiple candidates)", (t) => {
  let tableNames = ["table1", "table2"];
  let datasetIds = [
    { Dataset_ID: 8, Table_Name: "table1" },
    { Dataset_ID: 9, Table_Name: "table2" },
  ];
  let dl = new Map(); // dataset locations map
  dl.set(8, ["server1", "server2", "server3"]);
  dl.set(9, ["server2", "server1", "server3"]);

  let result = calculateCandidateTargets(
    tableNames,
    datasetIds,
    dl,
  );

  let expected = ["server1", "server2", "server3"];
  // expect all 3 servers are candidates
  t.truthy(expected.every((t) => result.includes(t)));
});

test("calculateCandidateTargets: failure", (t) => {
  let tableNames = ["table1", "table2"];
  let datasetIds = [
    { Dataset_ID: 8, Table_Name: "table1" },
    { Dataset_ID: 9, Table_Name: "table2" },
  ];
  let dl = new Map(); // dataset locations map
  dl.set(8, ["server1"]);
  dl.set(9, ["server2"]);

  let result = calculateCandidateTargets(
    tableNames,
    datasetIds,
    dl,
  );

  let expected = [];
  // expect an empty result set
  t.deepEqual(result, expected);
});
