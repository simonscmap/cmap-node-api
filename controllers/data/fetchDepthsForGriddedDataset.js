const { internalRouter } = require ('../../utility/router/internal-router');

// fetcheDepths :: { id } -> [errorMessage?, data?]
const fetchDepths = async (dataset) => {
  let { Table_Name, Time_Min, Lat_Min, Lon_Min } = dataset;

  if (typeof Table_Name !== 'string') {
    return [new Error('unexpected arg type: Table_Name is not string')];
  }

  let latNextTick = parseFloat(Lat_Min) + 0.5;
  let lonNextTick = parseFloat(Lon_Min) + 0.5;

  let query = `select distinct depth from ${Table_Name} where
      time='${Time_Min}' AND
      lat between ${Lat_Min} AND ${latNextTick} AND
      lon between ${Lat_Min} AND ${lonNextTick}
      order by depth`;

  let [error, result] = await internalRouter (query);

  // TODO this could be a mssql response or a sparq sql response
  if (!error && result && result.recordset) {
    return [null, result.recordset];
  } else if (!error && result) {
    return [null, result];
  } else if (error) {
    return [error];
  } else {
    return [new Error ('Unknown error')];
  }
}

module.exports = fetchDepths;
