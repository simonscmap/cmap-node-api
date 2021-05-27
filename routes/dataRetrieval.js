const router = require('express').Router();
const dataRetrievalController = require('../controllers/dataRetrieval');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// dataRetrieval routes are no longer used by the web app, and can be removed if no longer
// in use by the SDKs

// Custom query statement route
router.get('/query', asyncControllerWrapper(dataRetrievalController.customQuery));

// Stored procedure route
router.get('/sp', asyncControllerWrapper(dataRetrievalController.storedProcedure));

// Table stats endpoint
router.get('/tablestats', asyncControllerWrapper(dataRetrievalController.tableStats));

// router.get('/implicit', asyncControllerWrapper(dataRetrievalController.implicit));

router.get('/csv', asyncControllerWrapper(dataRetrievalController.csv));

module.exports = router;