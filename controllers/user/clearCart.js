const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/clearCart");

// Remove all persisted favorites from db
module.exports = async (req, res) => {
  let pool = await pools.userReadAndWritePool;
  let request = new sql.Request(pool);

  request.input("userID", sql.Int, req.user.id);

  const query = `DELETE FROM [dbo].[tblUser_Dataset_Favorites]
                 WHERE User_ID = @userID`;

  try {
    await request.query(query);
  } catch (e) {
    log.error("error clearing cart", { error: e });
  }

  return res.sendStatus(200)
};
