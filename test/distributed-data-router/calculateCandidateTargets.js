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

  let {errors, candidateLocations} = calculateCandidateTargets(matchingTables, datasetIds, dl);

  let expected = ["server1"];
  t.is(errors.length, 0);
  t.truthy(expected.every((t) => candidateLocations.includes(t)));
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

  let {errors, candidateLocations} = calculateCandidateTargets(matchingTables, datasetIds, dl);

  let expected = ["server1", "server2", "server3"];
  t.is(errors.length, 0);

  // expect all 3 servers are candidates
  t.truthy(expected.every((t) => candidateLocations.includes(t)));
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

  let {errors, warnings, candidateLocations} = calculateCandidateTargets(matchingTables, datasetIds, dl);

  // expect warning
  t.is(errors.length, 0);
  t.is(warnings.length, 1);
  t.is(warnings[0][0], "no candidate servers identified");

  // expect an empty result set
  t.deepEqual(candidateLocations, []);
});

test("correctly handles when core table and dataset locations diverge", (t) => {
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

  let {errors, warnings, candidateLocations} = calculateCandidateTargets(matchingTables, datasetIds, dl);

  // expect warning
  t.is(errors.length, 0);
  t.is(warnings.length > 0, true);
  t.is(warnings[0][0], "could not match all ids");
  t.is(warnings[1][0], "matched a core table, forcing rainier");

  // expect an empty result set

  t.deepEqual(candidateLocations, ["rainier"]);
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

  let {errors, candidateLocations} = calculateCandidateTargets(matchingTables, datasetIds, dl);

  // expect error message
  t.is(errors.length, 0);

  // expect an empty result set
  t.deepEqual(candidateLocations, ["rainier"]);
});
