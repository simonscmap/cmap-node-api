const router = require('express').Router();
const dataController = require('../controllers/data');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// Custom query statement route
router.get('/query', asyncControllerWrapper(dataController.customQuery));

// Stored procedure route
router.get('/sp', asyncControllerWrapper(dataController.storedProcedure));

// Table stats endpoint
router.get('/tablestats', asyncControllerWrapper(dataController.tableStats));

module.exports = router;