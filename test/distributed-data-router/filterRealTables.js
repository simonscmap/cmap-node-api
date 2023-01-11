const test = require("ava");
const {
  filterRealTables,
} = require("../../utility/router/pure");

test("identifies core tables", (t) => {
  let names = ['tblCore1'];
  let coreTables = ['tblCore1', 'tblCore2'];
  let datasetTables = ['tblDataset1','tblDataset2','tblDataset3','tblDataset4',];

  let result = filterRealTables({ extractedPrimaryTableNames: names }, coreTables, datasetTables);

  let {
    matchingCoreTables,
  } = result;

  t.deepEqual(matchingCoreTables, ['tblCore1']);
});

test("identifies dataset tables", (t) => {
  let names = ['tblDataset1'];
  let coreTables = ['tblCore1', 'tblCore2'];
  let datasetTables = ['tblDataset1','tblDataset2','tblDataset3','tblDataset4',];

  let result = filterRealTables({ extractedPrimaryTableNames: names }, coreTables, datasetTables);

  let {
    matchingDatasetTables,
  } = result;

  t.deepEqual(matchingDatasetTables, ['tblDataset1']);
});

test("reports omitted tables", (t) => {
  let names = ['tblCore1', 'tblDataset2', 'dne'];
  let coreTables = ['tblCore1', 'tblCore2'];
  let datasetTables = ['tblDataset1','tblDataset2','tblDataset3','tblDataset4',];

  let result = filterRealTables({ extractedPrimaryTableNames: names }, coreTables, datasetTables);

  let {
    matchingCoreTables,
    matchingDatasetTables,
    omittedTables,
  } = result;
  t.falsy(matchingCoreTables.includes('dne'));
  t.falsy(matchingDatasetTables.includes('dne'));
  t.truthy(omittedTables.includes('dne'));
});

test("flags if no tables are referenced", (t) => {
  let coreTables = ['tblCore1', 'tblCore2'];
  let datasetTables = ['tblDataset1','tblDataset2','tblDataset3','tblDataset4',];
  let queryAnalysis = {
    extractedTableNames: [],
    extractedPrimaryTableNames: [],
  };

  let result = filterRealTables(queryAnalysis, coreTables, datasetTables);

  let {
    noTablesNamed
  } = result;
  t.is(noTablesNamed, true);
});

test("no references check uses AST", (t) => {
  let coreTables = ['tblCore1', 'tblCore2'];
  let datasetTables = ['tblDataset1','tblDataset2','tblDataset3','tblDataset4',];
  let queryAnalysis = {
    extractedTableNames: ['alias'],
    extractedPrimaryTableNames: [],
  };

  let result = filterRealTables(queryAnalysis, coreTables, datasetTables);

  let {
    noTablesNamed
  } = result;
  t.is(noTablesNamed, false);
});
