const router = require('express').Router();
const collectionsController = require('../controllers/collections');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

/////////////////// collections root route  ///////////////////

router.get('/', asyncControllerWrapper(collectionsController.list));
router.get('/:id', asyncControllerWrapper(collectionsController.detail));

module.exports = router;