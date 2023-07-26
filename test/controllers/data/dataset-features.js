const { transformFeatureResults } = require('../../../controllers/data/transforms');
const initLogger = require ('../../../log-service');
const test = require('ava');

const log = initLogger('test/catalog/data/dataset-transform');

test('merges expected results from execs', (t) => {
  let ex1 = [
    [{ Table_Name: 'tblOne' }, { Table_Name: 'tblTwo' }],
    [{ table_name: 'tblTwo' }, { table_name: 'tblThree' }]
  ];

  let r1 = transformFeatureResults(ex1, log);
  t.is (Object.keys(r1).length, 3);
});

test('merges empty results from execs', (t) => {
  // both execs return empty arrays
  // expect transform to return an object with no keys
  let ex1 = [
    [],
    []
  ];

  let r1 = transformFeatureResults(ex1, log);
  t.is (Object.keys(r1).length, 0);
});

test('returns null when results are incomplete', (t) => {
  // only one array is returned in the recordsets
  // expect transform to return null
  let ex2 = [
    []
  ];

  let r2 = transformFeatureResults(ex2, log);
  t.is (r2, null);
});
