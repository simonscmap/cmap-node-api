const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');
const log = initializeLogger('controllers/user/removeCartItem');

// Remove persisted favorite from DB
module.exports = async (req, res) => {
  // TODO unhandled failure cases
  let pool = await pools.userReadAndWritePool;
  let request = new sql.Request(pool);

  request.input('userID', sql.Int, req.user.id);
  request.input('datasetID', sql.Int, req.body.itemID);

  const query = `DELETE FROM [dbo].[tblUser_Dataset_Favorites]
                 WHERE User_ID = @userID
                 AND Dataset_ID = @datasetID`;

  try {
    await request.query(query);
  } catch (e) {
    log.error('error removing cart item', { error: e });
  }

  return res.sendStatus(200);
};
