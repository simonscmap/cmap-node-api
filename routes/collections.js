const router = require('express').Router();
const passport = require('../middleware/passport');
const collectionsController = require('../controllers/collections');
const {
  validateCollectionsList,
  validateCollectionDetail,
} = require('../middleware/collectionsValidation');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

/////////////////// collections root route  ///////////////////

router.get(
  '/',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionsList,
  asyncControllerWrapper(collectionsController.list),
);
router.get(
  '/:id',
  passport.authenticate(['jwt', 'headerapikey'], { session: false }),
  validateCollectionDetail,
  asyncControllerWrapper(collectionsController.detail),
);

module.exports = router;
