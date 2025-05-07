const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');
const { safePath } = require('../../utility/objectUtils');
const { getDatasetId } = require('../../queries/datasetId');

const moduleLogger = initializeLogger('controllers/user/createSubscription');

const subscribeUserToDataset = async (
  userId,
  shortName,
  log = moduleLogger,
) => {
  // get dataset id
  const datasetId = await getDatasetId(shortName, log);

  if (!datasetId) {
    log.error('failed to create subscription, could not find dataset id', {
      shortName,
    });
    return [new Error('could not find id for shortName')];
  }

  const pool = await pools.userReadAndWritePool;

  const checkExisitsRequest = new sql.Request(pool);
  checkExisitsRequest.input('userID', sql.Int, userId);
  checkExisitsRequest.input('shortName', sql.VarChar, shortName);

  const checkQuery = `SELECT * from tblDataset_Subscribers
                      WHERE User_ID = @userId
                      AND Dataset_Name = @shortName`;

  log.trace('checking if subscription already exists');

  let checkExistsResponse;
  try {
    checkExistsResponse = await checkExisitsRequest.query(checkQuery);
  } catch (e) {
    log.error('error checking if subscription exists', { error: e, userId });
    return [new Error('error getting subscriptions')];
  }

  const checkExistsResult = safePath(['recordset'])(checkExistsResponse);

  if (checkExistsResult.length) {
    log.info('subscription already exists', {
      result: checkExistsResult,
      shortName: shortName,
    });
    return [
      false,
      {
        message: 'subscription already exists',
        created: safePath([0, 'Subscription_Date_Time'])(checkExistsResult),
        shortName,
      },
    ];
  }

  log.trace(
    'subscription does not already exist: proceeding to create new subscription',
  );

  const request = new sql.Request(pool);

  request.input('userID', sql.Int, userId);
  request.input('shortName', sql.VarChar, shortName);
  request.input('datasetID', sql.Int, datasetId);
  request.input('time', sql.VarChar, new Date().toISOString());

  const query = `INSERT into tblDataset_Subscribers
                   (User_ID, Dataset_Name, Dataset_ID, Subscription_Date_Time)
                 VALUES
                   (@userID, @shortName, @datasetId, @time)`;

  let response;
  try {
    response = await request.query(query);
  } catch (e) {
    log.error('error inserting subscription', { error: e, userId });
    return [new Error('error inserting subscription')];
  }

  log.info('created user subscription', { userId, datasetId });
  return [false, { message: 'created new subscription' }];
};

const createSubscriptionController = async (req, res) => {
  const log = moduleLogger.setReqId(req.requestId);
  const shortName = req.body.shortName;
  const userId = req.user.id;

  if (!shortName) {
    log.info('failed to create subscription, no shortname provided', {
      body: req.body,
    });
    return res.status(400).send('no shortName provided');
  }

  const [error, result] = await subscribeUserToDataset(userId, shortName, log);
  if (error) {
    res.status(500).send(error.message);
  }

  return res.status(200).json(result);
};

module.exports = {
  controller: createSubscriptionController,
  subscribeUserToDataset,
};
