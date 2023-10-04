const test = require('ava');
const {
  extractQueryConstraints
} = require('../../../controllers/data/extractQueryConstraints');

test('extracts constraints from typical download query with subset using between operators', (t) => {
  let q = `select * from tblTN397_Gradients4_Influx_Stations_v1_1 where cast(time as date) between '2021-11-27' and '2021-12-04T23:59:59Z' and lat between -2.5 and 28 and lon between -150 and -125 and depth between 5 and 10`;

  let r = extractQueryConstraints (q);
  let expect = {
    time: { min: '2021-11-27', max: '2021-12-04T23:59:59Z'},
    lat: { min: -2.5, max: 28 },
    lon: { min: -150, max: -125 },
    depth: { min: 5, max: 10 },
  }

  t.deepEqual(r, expect);
});


test('extracts constraints from query using less than and greater than operators', (t) => {
  let q = `select * from tblTN397_Gradients4_Influx_Stations_v1_1 where cast(time as date) >= '2021-11-27' and cast(time as date) <= '2021-12-04T23:59:59Z' and lat >= -2.5 and lat <= 28 and lon >= -150 and lon <= -125 and depth >= 5 and depth <= 10`;

  let r = extractQueryConstraints (q);
  let expect = {
    time: { min: '2021-11-27', max: '2021-12-04T23:59:59Z'},
    lat: { min: -2.5, max: 28 },
    lon: { min: -150, max: -125 },
    depth: { min: 5, max: 10 },
  }

  t.deepEqual(r, expect);
});

test('works with exact time, e.g. an equals comparator', (t) => {
  let q = `select distinct depth from tblMITgcm_SWOT_3D where time='2011-09-13' AND lat between -57.5 AND -57.4 AND lon between 148 AND 148.1 order by depth`;
  let r = extractQueryConstraints (q);
  let expect = {
    time: { min: '2011-09-13', max: '2011-09-13'},
    lat: { min: -57.5, max: -57.4 },
    lon: { min: 148, max: 148.1 },
    depth: {}
  }

  t.deepEqual(r, expect);
});

test('works with monthly climatology (month saved as time)', (t) => {
  let monthlyClimatologyQuery = `select * from tblWOA_2018_qrtdeg_Climatology where month between '2' and '3' and lat between -89.9 and 89.9 and lon between -179.9 and 179.9 and depth between 0 and 1500`;
  let r = extractQueryConstraints (monthlyClimatologyQuery);
  // NOTE the query constrains 'month', but for simplicity we save that
  // as the time constraint, so that calculateQuerySize doesn't need
  // to handle the complexity of different keys
  let expect = {
    time: { min: '2', max: '3'},
    lat: { min: -89.9, max: 89.9 },
    lon: { min: -179.9, max: 179.9 },
    depth: { min: 0, max: 1500 }
  }

  t.deepEqual(r, expect);
});


// TODO: test query with no depth constraint
