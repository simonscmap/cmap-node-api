const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');
const { transformResultsWithDatasets } = require('./helpers/transformUtils');

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
        1 as isPublic,
        c.Created_At as createdDate,
        c.Modified_At as modifiedDate,
        u.FirstName + ' ' + u.FamilyName as ownerName,
        u.Institute as ownerAffiliation,
        0 as isOwner,
        1 as isFollowing,
        c.Downloads as downloads,
        c.Views as views,
        c.Copies as copies,
        (SELECT COUNT(*) FROM tblCollection_Follows WHERE Collection_ID = c.Collection_ID) as followerCount,
        cd.Dataset_Short_Name as datasetShortName,
        d.Dataset_Long_Name as datasetLongName,
        CASE WHEN d.Dataset_Name IS NULL THEN 1 ELSE 0 END as isInvalid,
        cf.Follow_Date as followDate
      FROM tblCollection_Follows cf
      INNER JOIN tblCollections c ON cf.Collection_ID = c.Collection_ID
      INNER JOIN tblUsers u ON c.User_ID = u.UserID
      LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
      LEFT JOIN tblDatasets d ON cd.Dataset_Short_Name = d.Dataset_Name
      WHERE cf.User_ID = @userId
        AND c.Private = 0
      ORDER BY cf.Follow_Date DESC, cd.Dataset_Short_Name
    `);

    const followedCollections = transformResultsWithDatasets(result.recordset);

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
