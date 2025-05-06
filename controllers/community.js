const sql = require('mssql');
const { userReadAndWritePool } = require('../dbHandlers/dbPools');
const initLogger = require('../log-service');
const moduleLogger = initLogger('community/errorReport');
const { isProduction } = require('../config/environment');
// Front end error boundary sends error reports to this endpoints when the app crashes
module.exports.errorReport = async (req, res, next) => {
  let pool = await userReadAndWritePool;
  let request = await new sql.Request(pool);
  let { errorText, browserInfo, osInfo } = req.body;

  if (isProduction) {
    // only record front end errors in porduction
    moduleLogger.error('front end error', { ...req.body });

    request.input('errorText', sql.NVarChar, errorText);
    request.input('browserInfo', sql.NVarChar, browserInfo);
    request.input('osInfo', sql.NVarChar, osInfo);

    let query = `
        INSERT INTO [dbo].[tblFront_End_Errors] ([OS_Info], [Browser_Info], [Error])
        VALUES (@osInfo, @browserInfo, @errorText)
    `;

    try {
      await request.query(query);
    } catch (e) {
      moduleLogger.error('error inserting front end error report', {
        body: req.body,
      });
    }
  } else {
    // in development, observe what will be logged in production at less severe log level
    moduleLogger.debug('front end error', { ...req.body });
  }

  res.end();
  return next();
};
