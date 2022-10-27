const test = require("ava");
const {
  extractTableNamesFromAST,
  transformDatasetServersListToMap,
  queryToAST,
  removeSQLBlockComments,
  removeSQLDashComments,
  isSproc,
} = require("../../utility/router/pure");

const {
  extractTableNamesFromQuery,
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
  let q = "select * from tblMyTable";
  let ast = queryToAST(q);
  let r = extractTableNamesFromAST(ast);
  t.deepEqual(r, ["tblMyTable"]);

  // parse an empty query
  // NOTE: extractTableNamesFromAST will get [] for an AST
  // and will swallow an error trying to access the prop it wants
  let ast2 = queryToAST("");
  let r2 = extractTableNamesFromAST(ast2);
  t.deepEqual(r2, []);

  // parse a query with an EXEC commented out /* */, but with a SELECT command
  let q3 = "/* EXEC sproc 'tblFake'*/ select * from tblMyTable";
  let ast3 = queryToAST(q3);
  t.is(ast3.ast.from.length, 1);
  t.is(ast3.ast.from[0].table, "tblMyTable");
});

test("removeSQLBlockComments", (t) => {
  let q1 = `here is a /**/ block comment`;
  let r1 = removeSQLBlockComments(q1);
  t.is(r1, "here is a  block comment");

  let q0 = `here are several /**/ block /**/ comments /**/`;
  let r0 = removeSQLBlockComments(q0);
  t.is(r0, "here are several  block  comments ");

  let q2 = `here is
a multiline /*
 comment
 comment
*/ block comment`;
  let r2 = removeSQLBlockComments(q2);
  t.is(r2, "here is\na multiline  block comment");

  let q3 = "here is a \n multi-line /* comment \n comment \n */ block comment";
  let r3 = removeSQLBlockComments(q3);
  t.is(r3, "here is a \n multi-line  block comment");
});

test("removeSQLDashComments", (t) => {
  let q1 = `here is a -- dash comment`;
  let r1 = removeSQLDashComments(q1);
  t.is(r1, "here is a ");
});

test("isSproc", (t) => {
  // basic exec
  let q1 = "EXEC sproc 'tblMyTable'";
  let r1 = isSproc(q1);
  t.truthy(r1);

  // commented execs, should not be false positives
  let q2 = `-- EXEC sproc 'tblFakeTable'
            SELECT * from myTable`;
  let r2 = isSproc(q2);
  t.falsy(r2);

  let q3 = `-- EXEC sproc 'tblFakeTable'
            /* EXEC
               EXEC
            */
            SELECT * from myTable`;
  let r3 = isSproc(q3);
  t.falsy(r3);
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

  let result = calculateCandidateTargets(tableNames, datasetIds, dl);

  let expected = ["server1"];
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

  let result = calculateCandidateTargets(tableNames, datasetIds, dl);

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

  let result = calculateCandidateTargets(tableNames, datasetIds, dl);

  let expected = [];
  // expect an empty result set
  t.deepEqual(result, expected);
});
