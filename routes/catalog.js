const router = require('express').Router();
const catalogController = require('../controllers/catalog');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

/////////////////// catalog root route  ///////////////////
router.get('/', asyncControllerWrapper(catalogController.retrieve));
router.get('/auditcatalogvariablenames', asyncControllerWrapper(catalogController.auditCatalogVariableNames));
router.get('/datasets', asyncControllerWrapper(catalogController.datasets));
router.get('/description', asyncControllerWrapper(catalogController.description));
router.get('/submissionoptions', asyncControllerWrapper(catalogController.submissionOptions));

module.exports = router;