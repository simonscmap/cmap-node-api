const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const datasetCatalogQuery = require("../../dbHandlers/datasetCatalogQuery");
const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/getCart");

// Retrieve persisted favorites for a user
module.exports = async (req, res) => {
  // TODO unhandled failure case
  let pool = await pools.userReadAndWritePool;
  let request = await new sql.Request(pool);

  request.input("userID", sql.Int, req.user.id);

  const query =
    datasetCatalogQuery +
    `
            AND cat.Dataset_ID IN (
                SELECT Dataset_ID
                FROM tblUser_Dataset_Favorites
                WHERE User_ID = @userID
            )
        `;

  try {
    let result = await request.query(query);
    // TODO unsafe head
    let datasets = result.recordsets[0];
    datasets.forEach((e) => {
      e.Sensors = [...new Set(e.Sensors.split(","))];
    });

    // TODO unhandled faiure case
    return res.send(JSON.stringify(datasets));
  } catch (e) {
    log.error("error getting cart", { error: e })
    return res.sendStatus(500);
  }
};
