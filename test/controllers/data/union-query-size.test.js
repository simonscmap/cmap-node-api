const test = require('ava');
const {
  calculateSizeForConstraintGroups,
} = require('../../../controllers/data/calculateQuerySize');
const {
  extractQueryConstraintGroups,
  extractQueryConstraints,
} = require('../../../controllers/data/extractQueryConstraints');

const query = `SELECT [time], lat, lon, [sst] FROM (
  SELECT [time], lat, lon, [sst], 0 dummyCol
  FROM [tblERA5_monthly_averaged_single_level]
  WHERE [time] BETWEEN '1981-09-01T00:00:00.000Z' AND '1981-09-02T00:00:00.000Z'
    AND lat BETWEEN 28.606 AND 32.575
    AND lon BETWEEN 174.29 AND 180
  UNION
  SELECT [time], lat, lon, [sst], 1 dummyCol
  FROM [tblERA5_monthly_averaged_single_level]
  WHERE [time] BETWEEN '1981-09-01T00:00:00.000Z' AND '1981-09-02T00:00:00.000Z'
    AND lat BETWEEN 28.606 AND 32.575
    AND lon BETWEEN -180 AND -172.037
) AS t
ORDER BY dummyCol, [time], lat, lon`;

test('extracts constraints from each SELECT in a derived UNION', (t) => {
  const groups = extractQueryConstraintGroups(query);

  t.deepEqual(groups, [
    {
      time: {
        min: '1981-09-01T00:00:00.000Z',
        max: '1981-09-02T00:00:00.000Z',
      },
      lat: { min: 28.606, max: 32.575 },
      lon: { min: 174.29, max: 180 },
      depth: {},
    },
    {
      time: {
        min: '1981-09-01T00:00:00.000Z',
        max: '1981-09-02T00:00:00.000Z',
      },
      lat: { min: 28.606, max: 32.575 },
      lon: { min: -180, max: -172.037 },
      depth: {},
    },
  ]);
});

test('sums estimates for disjoint antimeridian branches', (t) => {
  const branchGroups = extractQueryConstraintGroups(query);
  const dataset = {
    Row_Count: 1072501920,
    Temporal_Resolution: 'Regular',
    Time_Min: '1981-09-01T00:00:00.000Z',
    Time_Max: '1981-09-02T00:00:00.000Z',
    Lat_Min: -90,
    Lat_Max: 90,
    Lon_Min: -179.75,
    Lon_Max: 180,
  };

  const [size] = calculateSizeForConstraintGroups(
    branchGroups,
    dataset,
    [],
  );

  t.true(size > 0, `expected a positive estimate, got ${size}`);
  t.true(size < 2000000, `expected estimate below limit, got ${size}`);
  t.true(size < dataset.Row_Count);
});

test('does not treat a single SELECT as a UNION', (t) => {
  const simpleQuery = `SELECT [time] FROM [tblExample] WHERE [time] BETWEEN '2020-01-01' AND '2020-01-02' AND lat BETWEEN -1 AND 1`;

  t.is(extractQueryConstraintGroups(simpleQuery), null);
  t.deepEqual(extractQueryConstraints(simpleQuery), {
    time: { min: '2020-01-01', max: '2020-01-02' },
    lat: { min: -1, max: 1 },
    lon: {},
    depth: {},
  });
});
