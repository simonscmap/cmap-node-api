const test = require('ava');
const generateQuery = require('../../../controllers/data/generateQueryFromConstraints');

// Helper to create monthly climatology metadata
const createMonthlyClimatologyMetadata = () => ({
  Temporal_Resolution: 'Monthly Climatology'
});

// Helper to create regular metadata
const createRegularMetadata = () => ({
  Temporal_Resolution: 'Daily'
});

test('non-monthly climatology data should use time constraints', (t) => {
  const tablename = 'test_table';
  const constraints = {
    time: { min: '2020-01-01', max: '2020-12-31' }
  };
  const metadata = createRegularMetadata();

  const result = generateQuery(tablename, constraints, metadata, 'data');

  t.true(result.includes("time between '2020-01-01' and '2020-12-31'"), 'Should use time constraint');
  t.false(result.includes('month'), 'Should not use month constraint');
});

test('monthly climatology: start month < end month', (t) => {
  const tablename = 'climatology_table';
  const constraints = {
    time: { min: '2020-03-15', max: '2020-08-20' } // March to August
  };
  const metadata = createMonthlyClimatologyMetadata();

  const result = generateQuery(tablename, constraints, metadata, 'data');

  t.true(result.includes('month between 3 and 8'), 'Should use month constraint 3-8');
  t.false(result.includes('time between'), 'Should not use time constraint');
});

test('monthly climatology: start month > end month should swap', (t) => {
  const tablename = 'climatology_table';
  const constraints = {
    time: { min: '2020-10-15', max: '2020-05-20' } // October to May (should swap)
  };
  const metadata = createMonthlyClimatologyMetadata();

  const result = generateQuery(tablename, constraints, metadata, 'data');

  t.true(result.includes('month between 5 and 10'), 'Should swap to month constraint 5-10');
  t.false(result.includes('time between'), 'Should not use time constraint');
});

test('monthly climatology: start month = end month', (t) => {
  const tablename = 'climatology_table';
  const constraints = {
    time: { min: '2020-07-01', max: '2020-07-31' } // Same month (July)
  };
  const metadata = createMonthlyClimatologyMetadata();

  const result = generateQuery(tablename, constraints, metadata, 'data');

  t.true(result.includes('month between 7 and 7'), 'Should use month constraint 7-7');
  t.false(result.includes('time between'), 'Should not use time constraint');
});

test('monthly climatology with lat/lon constraints', (t) => {
  const tablename = 'climatology_table';
  const constraints = {
    time: { min: '2020-01-15', max: '2020-06-20' },
    lat: { min: -10, max: 10 },
    lon: { min: -180, max: 180 }
  };
  const metadata = createMonthlyClimatologyMetadata();

  const result = generateQuery(tablename, constraints, metadata, 'data');

  t.true(result.includes('month between 1 and 6'), 'Should use month constraint 1-6');
  t.true(result.includes('lat between -10 and 10'), 'Should include lat constraint');
  t.true(result.includes('lon between -180 and 180'), 'Should include lon constraint');
  t.false(result.includes('time between'), 'Should not use time constraint');
});

test('monthly climatology: December to January (year boundary)', (t) => {
  const tablename = 'climatology_table';
  const constraints = {
    time: { min: '2020-12-01', max: '2021-01-31' } // December to January
  };
  const metadata = createMonthlyClimatologyMetadata();

  const result = generateQuery(tablename, constraints, metadata, 'data');

  t.true(result.includes('month between 1 and 12'), 'Should swap to month constraint 1-12');
  t.false(result.includes('time between'), 'Should not use time constraint');
});