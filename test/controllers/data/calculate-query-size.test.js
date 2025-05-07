const test = require('ava');
const {
  getRatio,
  getDateRatio,
  // getLatRatio,
  // getLonRatio,
  // getDepthRatio,
  // calculateGriddedDataSubquerySize,
} = require('../../../controllers/data/calculateQuerySize');

test('getDateRatio for normal dates', (t) => {
  let [warning, result] = getDateRatio(
    '2010-12-31',
    '2011-12-31',
    '2011-01-01',
    '2011-02-01',
    false,
  );
  t.is(warning, null);
  t.is(result, 0.08493150684931507);
});

test('getDateRatio for monthly climatology', (t) => {
  let [warning, result] = getDateRatio(null, null, '2', '3', true);
  t.is(warning, null);
  t.is(result, 0.16666666666666666);
});

test('getRatio handles subset outside range', (t) => {
  // Dataset min & max
  let Lat_Min = -89.875;
  let Lat_Max = 89.875;

  // let Lon_Min = -179.875;
  // let Lon_Max = 179.875;

  // subset lat is wider by a quarter degree
  let [warning, r] = getRatio(Lat_Min, Lat_Max, -89.9, 89.9, 'lat');

  t.is(warning, null);
  t.is(r, 1);
});
