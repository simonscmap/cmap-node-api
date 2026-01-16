const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/listFollowed');

module.exports = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  const userId = req.user.id;

  log.info('Fetching followed collections', {
    userId
  });

  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (error) {
    log.error('Failed to get database pool', {
      error: error && error.message,
      userId
    });
    return res.status(500).json({
      error: 'Failed to connect to database'
    });
  }

  try {
    const request = new sql.Request(pool);
    request.input('userId', sql.Int, userId);

    const result = await request.query(`
      SELECT
        c.Collection_ID as id,
        c.Collection_Name as name,
        c.Description as description,
        u.FirstName + ' ' + u.FamilyName as ownerName,
        u.Institute as ownerAffiliation,
        cf.Follow_Date as followDate,
        c.Modified_At as modifiedDate,
        c.Views as views,
        (SELECT COUNT(*) FROM tblCollection_Datasets WHERE Collection_ID = c.Collection_ID) as datasetCount,
        (SELECT COUNT(*) FROM tblCollection_Follows WHERE Collection_ID = c.Collection_ID) as follows,
        CAST(1 AS BIT) as isPublic
      FROM tblCollection_Follows cf
      INNER JOIN tblCollections c ON cf.Collection_ID = c.Collection_ID
      INNER JOIN tblUsers u ON c.User_ID = u.UserID
      WHERE cf.User_ID = @userId
        AND c.Private = 0
      ORDER BY cf.Follow_Date DESC
    `);

    const followedCollections = result.recordset.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      ownerName: row.ownerName,
      ownerAffiliation: row.ownerAffiliation,
      followDate: row.followDate ? new Date(row.followDate).toISOString() : null,
      modifiedDate: row.modifiedDate ? new Date(row.modifiedDate).toISOString() : null,
      views: row.views,
      datasetCount: row.datasetCount,
      follows: row.follows,
      isPublic: Boolean(row.isPublic)
    }));

    log.info('Followed collections retrieved', {
      userId,
      count: followedCollections.length
    });

    return res.status(200).json(followedCollections);
  } catch (err) {
    log.error('GET /user/followed-collections failed', {
      userId,
      error: err && err.message,
      stack: err && err.stack
    });

    return res.status(500).json({
      error: 'Failed to retrieve followed collections'
    });
  }
};
