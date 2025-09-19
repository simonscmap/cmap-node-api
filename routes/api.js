const router = require('express').Router();
const multer = require('multer');
const passport = require('../middleware/passport');
const upload = multer();
const newsRoutes = require('./news');
const notificationsRoutes = require('./notifications');
const userRoutes = require('./user');
const dataRoutes = require('./data');
const bulkDownloadRoutes = require('./bulk-download');
const catalogRoutes = require('./catalog');
const communityRoutes = require('./community');
const highlightsRoutes = require('./highlights');
const dataSubmissionRoutes = require('./dataSubmission');
const createNewLogger = require('../log-service');
const pools = require('../dbHandlers/dbPools');
const log = createNewLogger().setModule('routes/api.js');
const sql = require('mssql');

let passportMethods = ['headerapikey', 'jwt'];
let passportOptions = { session: false };

const saveApiQueryInfo = async (id, queryType, matchingTables) => {
  if (!Array.isArray(matchingTables)) {
    log.warn('no matching tables; unable to save api call query info', {
      id,
      queryType,
      matchingTables,
    });
  }

  const pool = await pools.userReadAndWritePool;

  const insertJobs = matchingTables.map(async (tableName) => {
    const request = await new sql.Request(pool);
    request.input('Call_ID', sql.Int, id);
    request.input('Type', sql.VarChar, queryType);
    request.input('Table_Name', sql.VarChar, tableName);
    const query = `INSERT INTO tblApi_Query
      (Call_ID, Type, Table_Name)
      VALUES (@Call_ID, @Type, @Table_Name)`;
    return await request.query(query);
  });

  try {
    await Promise.all(insertJobs);
    log.info('inserted call reference into tblApi_Query', {
      id,
      queryType,
      matchingTables,
    });
  } catch (e) {
    log.error('error inserting data into tblApi_Query', e);
  }
};

const saveCall = (req, res, next) => {
  res.on('finish', async () => {
    // allows ApiCallDetails to record response status
    const apiCallRecordId = await req.cmapApiCallDetails.save(res, {
      caller: 'api',
    });

    const queryType = req.sprocName || req.queryType;
    const tableNames =
      req.matchingTables && req.matchingTables.matchingDatasetTables;
    if (apiCallRecordId && tableNames) {
      try {
        await saveApiQueryInfo(apiCallRecordId, queryType, tableNames);
      } catch (e) {
        log.error('error attempting to save api query info', e);
      }
    } else {
      // log.trace ('missing parameters, skiping attempt to save api query info');
    }
  });
  next();
};

const logRouteComplete = (req, res, next) => {
  log.info('response complete', { requestId: req.requestId });
  next();
};

// Usage metrics logging
router.use(saveCall);

router.use('/news', newsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/user', userRoutes);
router.use('/data', dataRoutes);
router.use('/data', bulkDownloadRoutes);
router.use('/catalog', catalogRoutes);
router.use('/highlights', highlightsRoutes);
router.use('/community', communityRoutes);
router.use(
  '/datasubmission',
  passport.authenticate(passportMethods, passportOptions),
  upload.any(),
  dataSubmissionRoutes,
);

router.use(logRouteComplete);

// catch-all error logging
// NOTE this must take 4 arguments
// see: http://expressjs.com/en/guide/using-middleware.html#middleware.error-handling
router.use((err, req, res, next) => {
  log.error('an error occurred in the api catch-all', {
    error: err,
    originalUrl: req.originalUrl,
  });
  // sometimes an error will occur AFTER a response has been sent,
  // in which case, we should not attempt to send another response
  if (res.headersSent) {
    return;
  }
  res.sendStatus(500);
  return next();
});

router.use((req, res, next) => {
  if (res.headersSent) {
    return;
  }
  log.info('returning 404 from api', { originalUrl: req.originalUrl });
  res.sendStatus(404);
  return next();
});

module.exports = router;
