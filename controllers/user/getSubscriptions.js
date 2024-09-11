const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const initializeLogger = require("../../log-service");
const { safePath } = require("../../utility/objectUtils");

const log = initializeLogger("controllers/user/getSubscriptions");

module.exports = async (req, res) => {
  const pool = await pools.userReadAndWritePool;
  const request = new sql.Request(pool);

  request.input("userID", sql.Int, req.user.id);

  const query = `SELECT ds.User_ID, ds.Dataset_ID, ds.Dataset_Name, d.Dataset_Long_Name
                 FROM tblDataset_Subscribers ds
                 JOIN tblDatasets d ON d.ID = ds.Dataset_ID
                 WHERE User_ID = @userID`;

  let response;
  try {
    response = await request.query(query);
  } catch (e) {
    log.error("error getting subscriptions", { error: e, userId: req.user.id })
    return res.status(500).send('error getting subscriptions');
  }

  const result = safePath (['recordset']) (response);

  if (result) {
    return res.json (result);
  } else {
    log.warn ("no results returned", { userId: req.user.id });
    res.status(400).send ('no results');
  }
};
