const test = require('ava');
const {
  getDateRatio,
  getLatRatio,
  getLonRatio,
  getDepthRatio,
  calculateGriddedDataSubquerySize,
} = require('../../../controllers/data/calculateQuerySize');

test('getDateRatio for normal dates', (t) => {
  let [warning, result] = getDateRatio(
    '2010-12-31',
    '2011-12-31',
    '2011-01-01',
    '2011-02-01',
    false
  );
  t.is(warning, null);
  t.is(result, 0.08493150684931507);
});

test('getDateRatio for monthly climatology', (t) => {
  let [warning, result] = getDateRatio(
    '', '',
    '', '',
    false
  );
  t.is(warning, null);
  t.is(result, 0.08493150684931507);
});
