const test = require('ava');
const {
  calculateFactors,
  getWrappedLonRatio,
} = require('../../../controllers/data/calculateQuerySize');
const {
  extractQueryConstraints,
} = require('../../../controllers/data/extractQueryConstraints');

const query = `SELECT [time], AVG(lat) AS lat, AVG(lon) AS lon
FROM [tblSST_AVHRR_OI_NRT]
WHERE [time] BETWEEN '1981-09-01T00:00:00.000Z' AND '1981-09-01T00:00:00.000Z'
  AND lat BETWEEN 18.004 AND 27.896
  AND NOT lon BETWEEN -153.854 AND 170.029
GROUP BY [time]`;

test('extracts numeric NOT BETWEEN longitude constraints', (t) => {
  const constraints = extractQueryConstraints(query);

  t.deepEqual(constraints.lon, {
    notBetween: { min: -153.854, max: 170.029 },
  });
});

test('counts discrete longitude coordinates outside the excluded interval', (t) => {
  const [warning, ratio] = getWrappedLonRatio(-1, 1, 0.5, -0.5, 0.5);

  t.is(warning, null);
  t.is(ratio, 2 / 5);
});

test('counts wrapped coordinates on the SST quarter-degree grid', (t) => {
  const [warning, ratio] = getWrappedLonRatio(
    -179.875,
    179.875,
    0.25,
    -153.854,
    170.029,
  );

  t.is(warning, null);
  t.is(ratio, 145 / 1440);
});

test('uses the discrete wrapped-longitude ratio in the size projection', (t) => {
  const constraints = {
    time: { min: '2020-01-02', max: '2020-01-03' },
    lat: { min: -0.5, max: 0.5 },
    lon: { notBetween: { min: -0.5, max: 0.5 } },
    depth: {},
    deltas: { lon: 0.5 },
  };
  const dataset = {
    Row_Count: 10000,
    Temporal_Resolution: 'Regular',
    Time_Min: '2020-01-01',
    Time_Max: '2020-01-11',
    Lat_Min: -1,
    Lat_Max: 1,
    Lon_Min: -1,
    Lon_Max: 1,
  };
  const [, timeRatio, latRatio, lonRatio] = calculateFactors(
    constraints,
    dataset,
    [],
  );

  t.is(timeRatio, 0.1);
  t.is(latRatio, 0.5);
  t.is(lonRatio, 2 / 5);
});

test('falls back to the full longitude span when grid metadata is unavailable', (t) => {
  const [warning, ratio] = getWrappedLonRatio(-1, 1, undefined, -0.5, 0.5);

  t.truthy(warning);
  t.is(ratio, 1);
});
