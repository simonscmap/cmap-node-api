const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const initializeLogger = require("../../log-service");

const log = initializeLogger("controllers/user/deleteSubscription");

module.exports = async (req, res) => {
  const shortNames = req.body.shortNames;

  if (!Array.isArray (shortNames) || shortNames.length === 0) {
    log.error ('bad request: no shortNames provided', { body: req.body });
    return res.status (400).send ('no shortNames provided');
  }

  const pool = await pools.userReadAndWritePool;

  const request = new sql.Request(pool);

  request.input("userID", sql.Int, req.user.id);

  const list = shortNames.map (n => `'${n}'`).join (',');

  const query = `DELETE FROM tblDataset_Subscribers
                 WHERE User_ID = @userId
                 AND Dataset_Name IN (${list})`;


  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error("error deleting subscriptions", {
      error: e,
      userId: req.user.id,
      shortNames,
    })
    return res.status(500).send('error deleting subscriptions');
  }

  log.info ('deleted user subscriptions', {
    rowsAffected: result.rowsAffected,
    userId: req.user.id,
    shortNames: list,
  });

  return res.status (200).send ('Successfully deleted subscriptions');
};
