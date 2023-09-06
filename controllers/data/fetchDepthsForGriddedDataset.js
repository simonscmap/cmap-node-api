const { internalRouter } = require ('../../utility/router/internal-router');
const log = require('../../log-service') ('controllers/data/fetchDepthsForGriddedDataset');
// fetcheDepths :: { id } -> [errorMessage?, data?]
const fetchDepths = async (dataset) => {
  let { Table_Name, Time_Min, Lat_Min, Lon_Min } = dataset;

  if (typeof Table_Name !== 'string') {
    return [new Error('unexpected arg type: Table_Name is not string')];
  }

  let timeExpression = Time_Min ? `time='${Time_Min}'` : `month=1`;

  let latNextTick = parseFloat(Lat_Min) + 0.5;
  let lonNextTick = parseFloat(Lon_Min) + 0.5;

  let query = `select distinct depth from ${Table_Name} where
      ${timeExpression} AND
      lat between ${Lat_Min} AND ${latNextTick} AND
      lon between ${Lat_Min} AND ${lonNextTick}
      order by depth`;

  let [error, result] = await internalRouter (query);

  log.trace ('DEPTHS', { error, result });

  // On Prem
  if (!error && result && Array.isArray(result.recordset)) {
    // console.log(result.recordset);
    let depths = result.recordset.map (({ depth }) => depth);
    // console.log ('transformed depths', depths);
    return [null, depths];
  } else if (!error && result) {
    // Cluster
    // console.log(result);
    let depths = result.map(({ depth }) => depth);
    return [null, depths];
  } else if (error) {
    return [error];
  } else {
    return [new Error ('Unknown error')];
  }
}

module.exports = fetchDepths;
