const { internalRouter } = require('../../utility/router/internal-router');
// const log = require('../../log-service') ('controllers/data/fetchDepthsForGriddedDataset');
const { safePath } = require('../../utility/objectUtils');

// If dataset has a temporal resolution of hourly, check to see if it has an hour field
// which needs to be queried

// getHasHourField :: { tableName } -> [errorMessage?, data?]
const getHasHourField = async ({ tableName }) => {
  if (typeof tableName !== 'string') {
    return [new Error('unexpected arg type: Table_Name is not string')];
  }

  const query = `SELECT TOP 1 * from ${tableName}`;

  const [error, result] = await internalRouter(query);

  if (error) {
    return [
      {
        status: 500,
        message: 'error determining presence of hour column',
        err: error,
      },
    ];
  }

  const maybeHour = safePath(['0', 'hour'])(result);

  if (maybeHour) {
    return [null, true];
  } else {
    return [null, false];
  }
};

module.exports = getHasHourField;
