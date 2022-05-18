const uuidv1 = require("uuid/v1");
const sql = require("mssql");

const userDBConfig = require("../../config/dbConfig").userTableConfig;
const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/generateAPIKey");

const apiKeyTable = "tblApi_Keys";

// Create an API key
module.exports = async (req, res) => {
  let apiKey = uuidv1();

  let pool = await new sql.ConnectionPool(userDBConfig).connect();
  let request = new sql.Request(pool);
  request.input("description", sql.NVarChar, req.query.description);

  let query = `INSERT INTO ${apiKeyTable} (Api_Key, Description, User_ID)
               VALUES ('${apiKey}', @description, ${req.cmapApiCallDetails.userID})`;

  // TODO unhandled error case
  await request.query(query);

  log.info('generated api key', { user: req.cmapApiCallDetails.userID})

  return res.json(true);
};
