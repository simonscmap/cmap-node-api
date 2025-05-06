const logInit = require('../../log-service');
const log = logInit('controllers/data/depthCounter');

const darwinDepths = [
  5, 15, 25, 35, 45, 55, 65, 75.005, 85.025, 95.095, 105.31, 115.87, 127.15,
  139.74, 154.47, 172.4, 194.735, 222.71, 257.47, 299.93, 350.68, 409.93,
  477.47, 552.71, 634.735, 722.4, 814.47, 909.74, 1007.155, 1105.905, 1205.535,
  1306.205, 1409.15, 1517.095, 1634.175, 1765.135, 1914.15, 2084.035, 2276.225,
  2491.25, 2729.25, 2990.25, 3274.25, 3581.25, 3911.25, 4264.25, 4640.25,
  5039.25, 5461.25, 5906.25,
];

const piscesDepths = [
  0.494024991989, 1.54137504101, 2.64566898346, 3.81949496269, 5.07822418213,
  6.44061422348, 7.92956018448, 9.5729970932, 11.404999733, 13.4671401978,
  15.8100700378, 18.4955596924, 21.5988197327, 25.2114105225, 29.4447307587,
  34.4341506958, 40.3440513611, 47.3736915588, 55.764289856, 65.8072662354,
  77.8538513184, 92.3260726929, 109.729301453, 130.666000366, 155.850692749,
  186.125595093, 222.475204468, 266.040313721, 318.127410889, 380.213012695,
  453.937713623, 541.088928223, 643.566772461, 763.333129883, 902.339294434,
  1062.43994141, 1245.29101562, 1452.25097656, 1684.28405762, 1941.89294434,
  2225.07788086, 2533.3359375, 2865.70288086, 3220.82006836, 3597.03198242,
  3992.48388672, 4405.22412109, 4833.29101562, 5274.78417969, 5727.91699219,
];

const _piscesTables = ['tblPisces_NRT', 'tblPisces_NRT_Calendar'].map((s) =>
  s.toLowerCase(),
);

const _darwinTables = [
  'tblDarwin_Chl_Climatology',
  'tblDarwin_Ecosystem',
  'tblDarwin_Nutrient',
  'tblDarwin_Nutrient_Climatology',
  'tblDarwin_Ocean_Color',
  'tblDarwin_Phytoplankton',
  'tblDarwin_Plankton_Climatology',
].map((s) => s.toLowerCase());

const piscesTable = new Set(_piscesTables);
const darwinTable = new Set(_darwinTables);

const count = (tableName, depth1, depth2) => {
  if (typeof tableName !== 'string') {
    log.warn('wrong type argument: expected tableName to be string', {
      tableName,
    });
    return 0;
  } else if (typeof depth1 !== 'number') {
    log.warn('wrong type argument: expected depth1 to be number', { depth1 });
    return 0;
  } else if (typeof depth2 !== 'number') {
    log.warn('wrong type argument: expected depth2 to be number', { depth2 });
    return 0;
  }

  let normalizedTableName = tableName.toLowerCase();

  var count = 0;

  let presetDepths;
  if (piscesTable.has(normalizedTableName)) {
    presetDepths = piscesDepths;
  } else if (darwinTable.has(normalizedTableName)) {
    presetDepths = darwinDepths;
  } else {
    log.info('dataset table does not match darwin or pisces depths', {
      tableName,
    });
    return 0;
  }

  // count how many depth intervals exist between depth1 and depth1
  for (let i = 0; i < presetDepths.length; i++) {
    if (presetDepths[i] > depth2) {
      break;
    }
    if (presetDepths[i] > depth1) {
      count++;
    }
  }

  return count;
};

module.exports = {
  count,
  piscesTable,
  darwinTable,
  piscesDepths,
  darwinDepths,
};
