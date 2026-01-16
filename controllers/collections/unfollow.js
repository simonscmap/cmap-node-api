const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');
const { isUserFollowing, deleteFollow } = require('./helpers/followHelpers');

const log = initializeLogger('controllers/collections/unfollow');

module.exports = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  const userId = req.user.id;
  const collectionId = req.validatedParams.id;

  log.info('Unfollow collection request', {
    userId,
    collectionId
  });

  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (error) {
    log.error('Failed to get database pool', {
      error: error && error.message,
      userId,
      collectionId
    });
    return res.status(500).json({
      error: 'Failed to connect to database'
    });
  }

  try {
    const following = await isUserFollowing(pool, userId, collectionId);

    if (!following) {
      log.warn('Not following collection', {
        userId,
        collectionId
      });
      return res.status(404).json({
        error: 'Not following this collection'
      });
    }

    await deleteFollow(pool, userId, collectionId);

    log.info('Collection unfollowed successfully', {
      userId,
      collectionId
    });

    return res.status(200).json({
      collectionId,
      unfollowed: true
    });
  } catch (err) {
    log.error('DELETE /collections/:id/follow failed', {
      userId,
      collectionId,
      error: err && err.message,
      stack: err && err.stack
    });

    return res.status(500).json({
      error: 'Failed to unfollow collection'
    });
  }
};
