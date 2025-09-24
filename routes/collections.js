const router = require('express').Router();
const collectionsController = require('../controllers/collections');
const { validateCollectionsList, validateCollectionDetail } = require('../middleware/collectionsValidation');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

/////////////////// collections root route  ///////////////////

router.get('/', validateCollectionsList, asyncControllerWrapper(collectionsController.list));
router.get('/:id', validateCollectionDetail, asyncControllerWrapper(collectionsController.detail));

module.exports = router;