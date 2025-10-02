const router = require('express').Router();
const passport = require('../middleware/passport');
const optionalAuth = require('../middleware/optionalAuth');
const collectionsController = require('../controllers/collections');
const {
  validateCollectionsList,
  validateCollectionDetail,
} = require('../middleware/collectionsValidation');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

/////////////////// collections root route  ///////////////////

router.get(
  '/',
  optionalAuth(),
  validateCollectionsList,
  asyncControllerWrapper(collectionsController.list),
);
router.get(
  '/:id',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionDetail,
  asyncControllerWrapper(collectionsController.detail),
);
router.delete(
  '/:id',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  asyncControllerWrapper(collectionsController.delete),
);

module.exports = router;
