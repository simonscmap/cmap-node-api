const router = require('express').Router();
const catalogController = require('../controllers/catalog');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

/////////////////// catalog root route  ///////////////////

router.get('/', asyncControllerWrapper(catalogController.retrieve));
router.get('/auditcatalogvariablenames', asyncControllerWrapper(catalogController.auditCatalogVariableNames));
router.get('/autocompletevariablesnames', asyncControllerWrapper(catalogController.autocompleteVariableNames));
router.get('/cruisefullpage', asyncControllerWrapper(catalogController.cruiseFullPage));
router.get('/cruisesfromdataset', asyncControllerWrapper(catalogController.cruisesFromDataset));
router.get('/datasetfullpage', asyncControllerWrapper(catalogController.datasetFullPage));
router.get('/datasetmetadata', asyncControllerWrapper(catalogController.datasetMetadata));
router.get('/datasets', asyncControllerWrapper(catalogController.datasets));
router.get('/datasetsfromcruise', asyncControllerWrapper(catalogController.datasetsFromCruise));
router.get('/datasetsummary', asyncControllerWrapper(catalogController.datasetSummary));
router.get('/datasetvariables', asyncControllerWrapper(catalogController.datasetVariables));
router.get('/datasetvariableum', asyncControllerWrapper(catalogController.datasetVariableUM));
router.get('/description', asyncControllerWrapper(catalogController.description));
router.get('/keywords', asyncControllerWrapper(catalogController.keywords));
router.get('/membervariables', asyncControllerWrapper(catalogController.memberVariables));
router.get('/popular-datasets', asyncControllerWrapper(catalogController.popularDatasets));
router.get('/recent-datasets', asyncControllerWrapper(catalogController.recentDatasets));
router.get('/recommended-datasets', asyncControllerWrapper(catalogController.recommendedDatasets));
router.get('/searchcatalog', asyncControllerWrapper(catalogController.searchCatalog));
router.get('/searchcruises', asyncControllerWrapper(catalogController.searchCruises));
router.get('/submissionoptions', asyncControllerWrapper(catalogController.submissionOptions));
router.get('/variable', asyncControllerWrapper(catalogController.variable));
router.get('/variablesearch', asyncControllerWrapper(catalogController.variableSearch));
router.get('/visualizable-variables', asyncControllerWrapper(catalogController.listVisualizableVariables))

module.exports = router;
