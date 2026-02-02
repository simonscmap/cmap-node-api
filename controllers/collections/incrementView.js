const sql = require('mssql');
const initializeLogger = require('../../log-service');
const pools = require('../../dbHandlers/dbPools');

const moduleLogger = initializeLogger('controllers/collections/incrementView');

module.exports = async (req, res) => {
  const log = moduleLogger.setReqId(req.requestId);

  const collectionId = parseInt(req.params.id, 10);
  if (isNaN(collectionId) || collectionId < 1) {
    return res.status(400).json({ error: 'Invalid collection ID' });
  }

  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (error) {
    log.error('Failed to get database pool', { error: error.message });
    return res.status(500).json({ error: 'Database connection failed' });
  }

  try {
    const request = new sql.Request(pool);
    request.input('collectionId', sql.Int, collectionId);

    // If user is authenticated, check if they own this collection
    if (req.user && req.user.id) {
      request.input('userId', sql.Int, req.user.id);

      const ownerCheck = await request.query(`
        SELECT User_ID, Views
        FROM dbo.tblCollections
        WHERE Collection_ID = @collectionId
      `);

      if (ownerCheck.recordset.length === 0) {
        return res.status(404).json({ error: 'Collection not found' });
      }

      const collection = ownerCheck.recordset[0];
      if (collection.User_ID === req.user.id) {
        log.info('skipped view increment for owner', { collectionId, userId: req.user.id });
        return res.status(200).json({
          collectionId,
          views: collection.Views || 0,
          skipped: true,
        });
      }
    }

    const result = await request.query(`
      UPDATE dbo.tblCollections
      SET Views = ISNULL(Views, 0) + 1
      OUTPUT INSERTED.Views as views
      WHERE Collection_ID = @collectionId
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const views = result.recordset[0].views;
    log.info('incremented view count', { collectionId, views });

    return res.status(200).json({
      collectionId,
      views,
    });
  } catch (error) {
    log.error('Failed to increment view', { collectionId, error: error.message });
    return res.status(500).json({ error: 'Failed to increment view' });
  }
};
