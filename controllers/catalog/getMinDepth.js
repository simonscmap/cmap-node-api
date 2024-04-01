const { internalRouter } = require ('../../utility/router/internal-router');
const log = require('../../log-service') ('controllers/data/fetchDepthsForGriddedDataset');

// Fetch the minimum depth in a gridded dataset for a specific time slice
// Similar to /controllers/data/fetchDepthsForGriddedDataset

// fetchDepth :: { id } -> [errorMessage?, data?]
const fetchMinDepth = async ({ tableName, time, latMin, lonMin }) => {

  if (typeof tableName !== 'string') {
    return [new Error('unexpected arg type: Table_Name is not string')];
  }

  let timeExpression = time ? `time='${time}'` : `month=1`;
  timeExpression = timeExpression.replace ('Z', '');

  let latNextTick = parseFloat(latMin) + 0.5; // we can improve these by using the actual spatial resolution
  let lonNextTick = parseFloat(lonMin) + 0.5;

  let query = `SELECT DISTINCT depth from ${tableName}
      WHERE ${timeExpression}
      AND lat between ${latMin} AND ${latNextTick}
      AND lon between ${lonMin} AND ${lonNextTick}
      ORDER BY depth ASC`;

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

module.exports = fetchMinDepth;
