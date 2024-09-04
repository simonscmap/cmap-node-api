const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const initializeLogger = require("../../log-service");
const { safePath } = require("../../utility/objectUtils");
const { getDatasetId } = require("../../queries/datasetId");

const log = initializeLogger("controllers/user/createSubscription");

module.exports = async (req, res) => {
  if (!req.body.shortName) {
    log.info ('failed to create subscription, no shortname provided', { body: req.body });
    return res.status (400).send ('no shortName provided');
  }

  // get dataset id
  const datasetId = await getDatasetId (req.body.shortName, log);

  if (!datasetId) {
    log.error ('failed to create subscription, could not find dataset id', { body: req.body });
    return res.status (500).send ('could not find id for shortName');
  }

  const pool = await pools.userReadAndWritePool;

  const checkExisitsRequest = new sql.Request(pool);
  checkExisitsRequest.input("userID", sql.Int, req.user.id);
  checkExisitsRequest.input("shortName", sql.VarChar, req.body.shortName);

  const checkQuery = `SELECT * from tblDataset_Subscribers
                      WHERE User_ID = @userId
                      AND Dataset_Name = @shortName`;

  log.trace ('checking if subscription already exists');

  let checkExistsResponse;
  try {
    checkExistsResponse = await checkExisitsRequest.query(checkQuery);
  } catch (e) {
    log.error("error checking if subscription exists", { error: e, userId: req.user.id })
    return res.status(500).send('error getting subscriptions');
  }

  const checkExistsResult = safePath (['recordset']) (checkExistsResponse);

  if (checkExistsResult.length) {
    log.info ('subscription already exists', { result: checkExistsResult, shortName: req.body.shortName });
    return res.status (200).json ({
      message: 'subscription already exists',
      created: safePath ([ 0, 'Subscription_Date_Time']) (checkExistsResult),
      shortName: req.body.shortName,
    });
  }

  log.trace ('subscription does not already exist: proceeding to create new subscription');

  const request = new sql.Request(pool);

  request.input("userID", sql.Int, req.user.id);
  request.input("shortName", sql.VarChar, req.body.shortName);
  request.input("datasetID", sql.Int, datasetId);
  request.input("time", sql.VarChar, (new Date()).toISOString ());

  const query = `INSERT into tblDataset_Subscribers
                   (User_ID, Dataset_Name, Dataset_ID, Subscription_Date_Time)
                 VALUES
                   (@userID, @shortName, @datasetId, @time)`;

  let response;
  try {
    response = await request.query(query);
  } catch (e) {
    log.error("error inserting subscription", { error: e, userId: req.user.id })
    return res.status(500).send('error inserting subscription');
  }

  log.info ('created user subscription', { user: req.user.id, datasetId });

  return res.status(200).json ({ message: 'subscription created'});
};
