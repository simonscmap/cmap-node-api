const test = require("ava");
const {
  locationIncompatibilityMessage,
  calculateCandidateTargets,
} = require("../../utility/router/pure");

test("correctly identifies common target when only a single candidate", (t) => {
  let matchingTables = {
    matchingCoreTables: [],
    matchingDatasetTables: ["table1", "table2"],
    omittedTables: [],
    noTablesWarning: false,
  };
  let datasetIds = [
    { Dataset_ID: 8, Table_Name: "table1" },
    { Dataset_ID: 9, Table_Name: "table2" },
  ];
  let dl = new Map(); // dataset locations map
  dl.set(8, ["server1"]);
  dl.set(9, ["server2", "server1"]);

  let [errors, result] = calculateCandidateTargets(matchingTables, datasetIds, dl);

  let expected = ["server1"];
  t.is(errors, null);
  t.truthy(expected.every((t) => result.includes(t)));
});

test("correctly identifies a common target among many candidates", (t) => {
  let matchingTables = {
    matchingCoreTables: [],
    matchingDatasetTables: ["table1", "table2"],
    omittedTables: [],
    noTablesWarning: false,
  };
  let datasetIds = [
    { Dataset_ID: 8, Table_Name: "table1" },
    { Dataset_ID: 9, Table_Name: "table2" },
  ];
  let dl = new Map(); // dataset locations map
  dl.set(8, ["server1", "server2", "server3"]);
  dl.set(9, ["server2", "server1", "server3"]);

  let [errors, result] = calculateCandidateTargets(matchingTables, datasetIds, dl);

  let expected = ["server1", "server2", "server3"];
  t.is(errors, null);

  // expect all 3 servers are candidates
  t.truthy(expected.every((t) => result.includes(t)));
});

test("correctly errors when no common servers exist", (t) => {
  let matchingTables = {
    matchingCoreTables: [],
    matchingDatasetTables: ["table1", "table2"],
    omittedTables: [],
    noTablesWarning: false,
  };
  let datasetIds = [
    { Dataset_ID: 8, Table_Name: "table1" },
    { Dataset_ID: 9, Table_Name: "table2" },
  ];
  let dl = new Map(); // dataset locations map
  dl.set(8, ["server1"]);
  dl.set(9, ["server2"]);

  let [errors, result] = calculateCandidateTargets(matchingTables, datasetIds, dl);

  // expect error message to be the location-incompatibility message
  t.is(errors, locationIncompatibilityMessage);

  // expect an empty result set
  t.deepEqual(result, []);
});

test("correctly errors when core table and dataset locations diverge", (t) => {
  let matchingTables = {
    matchingCoreTables: ["coreTable"],
    matchingDatasetTables: ["table1", "table2"],
    omittedTables: [],
    noTablesWarning: false,
  };
  let datasetIds = [
    { Dataset_ID: 8, Table_Name: "table1" },
    { Dataset_ID: 9, Table_Name: "table2" },
  ];
  let dl = new Map(); // dataset locations map
  dl.set(8, ["server2"]);
  dl.set(9, ["server2"]);

  let [errors, result] = calculateCandidateTargets(matchingTables, datasetIds, dl);

  console.log(errors);
  // expect error message
  t.is(errors, locationIncompatibilityMessage);

  // expect an empty result set
  t.deepEqual(result, []);
});

test("correctly coerces Rainier when core table is referenced", (t) => {
  let matchingTables = {
    matchingCoreTables: ["coreTable"],
    matchingDatasetTables: ["table1", "table2"],
    omittedTables: [],
    noTablesWarning: false,
  };
  let datasetIds = [
    { Dataset_ID: 8, Table_Name: "table1" },
    { Dataset_ID: 9, Table_Name: "table2" },
  ];
  let dl = new Map(); // dataset locations map
  dl.set(8, ["server2", "rainier", "server3"]);
  dl.set(9, ["server2", "rainier", "server3"]);

  let [errors, result] = calculateCandidateTargets(matchingTables, datasetIds, dl);

  // expect error message
  t.is(errors, null);

  // expect an empty result set
  t.deepEqual(result, ["rainier"]);
});
