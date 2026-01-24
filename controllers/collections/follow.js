const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');
const {
  getCollectionForFollowValidation,
  createFollow
} = require('./helpers/followHelpers');

const log = initializeLogger('controllers/collections/follow');

module.exports = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  const userId = req.user.id;
  const collectionId = req.validatedParams.id;

  log.info('Follow collection request', {
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
    const collection = await getCollectionForFollowValidation(pool, collectionId);

    if (!collection) {
      log.warn('Collection not found for follow', {
        userId,
        collectionId
      });
      return res.status(404).json({
        error: 'Collection not found'
      });
    }

    if (collection.isPrivate) {
      log.warn('Cannot follow private collection', {
        userId,
        collectionId
      });
      return res.status(400).json({
        error: 'Cannot follow a private collection'
      });
    }

    if (collection.ownerId === userId) {
      log.warn('Cannot follow own collection', {
        userId,
        collectionId
      });
      return res.status(400).json({
        error: 'Cannot follow your own collection'
      });
    }

    const followDate = await createFollow(pool, userId, collectionId);

    if (!followDate) {
      log.warn('Already following collection', {
        userId,
        collectionId
      });
      return res.status(409).json({
        error: 'Already following this collection'
      });
    }

    log.info('Collection followed successfully', {
      userId,
      collectionId,
      followDate
    });

    return res.status(201).json({
      collectionId,
      followDate: new Date(followDate).toISOString(),
      collection: {
        id: collection.id,
        name: collection.name,
        ownerName: collection.ownerName,
        datasetCount: collection.datasetCount,
        followerCount: collection.followerCount + 1
      }
    });
  } catch (err) {
    log.error('POST /collections/:id/follow failed', {
      userId,
      collectionId,
      error: err && err.message,
      stack: err && err.stack
    });

    return res.status(500).json({
      error: 'Failed to follow collection'
    });
  }
};
