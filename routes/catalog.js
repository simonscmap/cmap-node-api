const router = require('express').Router();
const catalogController = require('../controllers/catalog');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

/////////////////// catalog root route  ///////////////////
router.get('/', asyncControllerWrapper(catalogController.retrieve));
router.get('/keywords', asyncControllerWrapper(catalogController.keywords));
router.get('/auditcatalogvariablenames', asyncControllerWrapper(catalogController.auditCatalogVariableNames));
router.get('/datasets', asyncControllerWrapper(catalogController.datasets));
router.get('/description', asyncControllerWrapper(catalogController.description));
router.get('/submissionoptions', asyncControllerWrapper(catalogController.submissionOptions));
router.get('/datasetfullpage', asyncControllerWrapper(catalogController.datasetFullPage));
router.get('/searchcatalog', asyncControllerWrapper(catalogController.searchCatalog));
router.get('/searchcruises', asyncControllerWrapper(catalogController.searchCruises));
router.get('/datasetsfromcruise', asyncControllerWrapper(catalogController.datasetsFromCruise));
router.get('/cruisesfromdataset', asyncControllerWrapper(catalogController.cruisesFromDataset));
router.get('/cruisefullpage', asyncControllerWrapper(catalogController.cruiseFullPage));
router.get('/membervariables', asyncControllerWrapper(catalogController.memberVariables));
router.get('/variablesearch', asyncControllerWrapper(catalogController.variableSearch));
router.get('/autocompletevariablesnames', asyncControllerWrapper(catalogController.autocompleteVariableNames));

module.exports = router;