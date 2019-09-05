const router = require('express').Router();
const dataRetrievalController = require('../controllers/dataRetrieval');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// Custom query statement route
router.get('/query', asyncControllerWrapper(dataRetrievalController.customQuery));

// Stored procedure route
router.get('/sp', asyncControllerWrapper(dataRetrievalController.storedProcedure));

// Table stats endpoint
router.get('/tablestats', asyncControllerWrapper(dataRetrievalController.tableStats));

// Table stats endpoint
router.get('/implicit', asyncControllerWrapper(dataRetrievalController.implicit));

module.exports = router;