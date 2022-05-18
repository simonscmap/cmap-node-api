const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/addCartItem");

// Persist favorite to DB
module.exports = async (req, res) => {
  let pool = await pools.userReadAndWritePool;
  let request = await new sql.Request(pool);

  request.input("userID", sql.Int, req.user.id);
  request.input("datasetID", sql.Int, req.body.itemID);

  const query = `INSERT INTO [dbo].[tblUser_Dataset_Favorites] (User_ID, Dataset_ID)
                 VALUES (@userID, @datasetID)`;

  try {
    await request.query(query);
  } catch (e) {
    log.error("error adding favorite", { error: e, userId: req.user.id })
    return res.sendStatus(500);
  }

  return res.sendStatus(200);
};
