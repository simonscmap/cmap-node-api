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
router.get('/datasetvariables', asyncControllerWrapper(catalogController.datasetVariables));
router.get('/datasetvariableum', asyncControllerWrapper(catalogController.datasetVariableUM));
router.get('/datasetmetadata', asyncControllerWrapper(catalogController.datasetMetadata));
router.get('/searchcatalog', asyncControllerWrapper(catalogController.searchCatalog));
router.get('/searchcruises', asyncControllerWrapper(catalogController.searchCruises));
router.get('/datasetsfromcruise', asyncControllerWrapper(catalogController.datasetsFromCruise));
router.get('/cruisesfromdataset', asyncControllerWrapper(catalogController.cruisesFromDataset));
router.get('/cruisefullpage', asyncControllerWrapper(catalogController.cruiseFullPage));
router.get('/membervariables', asyncControllerWrapper(catalogController.memberVariables));
router.get('/variablesearch', asyncControllerWrapper(catalogController.variableSearch));
router.get('/autocompletevariablesnames', asyncControllerWrapper(catalogController.autocompleteVariableNames));
router.get('/variable', asyncControllerWrapper(catalogController.variable));
router.get('/datasetsummary', asyncControllerWrapper(catalogController.datasetSummary));
router.get('/popular-datasets', asyncControllerWrapper(catalogController.popularDatasets));
router.get('/recent-datasets', asyncControllerWrapper(catalogController.recentDatasets));
router.get('/recommended-datasets', asyncControllerWrapper(catalogController.recommendedDatasets));


module.exports = router;
