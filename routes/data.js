const router = require('express').Router();
const dataController = require('../controllers/data');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// Custom query statement route
router.get('/query', asyncControllerWrapper(dataController.customQuery));

// Stored procedure route
router.get('/sp', asyncControllerWrapper(dataController.storedProcedure));

// Get list of cruises
router.get('/cruiselist', asyncControllerWrapper(dataController.cruiseList));

// Get cruise trajectory
router.get('/cruisetrajectory', asyncControllerWrapper(dataController.cruiseTrajectory));

// Table stats
router.get('/tablestats', asyncControllerWrapper(dataController.tableStats));

// Protobuf test
router.get('/proto', asyncControllerWrapper(dataController.testProto));

module.exports = router;