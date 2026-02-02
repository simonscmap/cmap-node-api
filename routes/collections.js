const router = require('express').Router();
const passport = require('../middleware/passport');
const optionalAuth = require('../middleware/optionalAuth');
const collectionsController = require('../controllers/collections');
const {
  validateCollectionsList,
  validateCollectionDetail,
  validateCollectionNameCheck,
  validateCollectionCreate,
  validateCollectionDelete,
  validateCollectionCopy,
  validateCollectionUpdate,
  validateCalculateRowCounts,
  validateCollectionFollow,
} = require('../middleware/collectionsValidation');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

router.get(
  '/',
  optionalAuth(),
  validateCollectionsList,
  asyncControllerWrapper(collectionsController.get),
);

router.get(
  '/verify-name',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionNameCheck,
  asyncControllerWrapper(collectionsController.verifyName),
);

router.post(
  '/calculate-row-counts',
  validateCalculateRowCounts,
  asyncControllerWrapper(collectionsController.calculateRowCounts),
);

router.get(
  '/followed',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  asyncControllerWrapper(collectionsController.listFollowed),
);

router.get(
  '/:id',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionDetail,
  asyncControllerWrapper(collectionsController.detail),
);

router.post(
  '/',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionCreate,
  asyncControllerWrapper(collectionsController.create),
);

router.patch(
  '/:id',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionUpdate,
  asyncControllerWrapper(collectionsController.update),
);

router.delete(
  '/:id',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionDelete,
  asyncControllerWrapper(collectionsController.delete),
);

router.post(
  '/:id/copy',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionCopy,
  asyncControllerWrapper(collectionsController.copy),
);

router.post(
  '/:id/follow',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionFollow,
  asyncControllerWrapper(collectionsController.follow),
);

router.delete(
  '/:id/follow',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionFollow,
  asyncControllerWrapper(collectionsController.unfollow),
);

router.post(
  '/:id/view',
  optionalAuth(),
  asyncControllerWrapper(collectionsController.incrementView),
);

module.exports = router;
