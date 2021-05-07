const router = require('express').Router();
const passport = require('../middleware/passport');

const dataController = require('../controllers/data');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// Custom query statement route
router.get('/query', passport.authenticate(['headerapikey', 'jwt', 'guest'], {session: false}), asyncControllerWrapper(dataController.customQuery));

// Stored procedure route
router.get('/sp', passport.authenticate(['headerapikey', 'jwt', 'guest'], {session: false}), asyncControllerWrapper(dataController.storedProcedure));

// Get list of cruises
router.get('/cruiselist', asyncControllerWrapper(dataController.cruiseList));

// Get cruise trajectory
router.get('/cruisetrajectory', asyncControllerWrapper(dataController.cruiseTrajectory));

// Table stats
router.get('/tablestats', asyncControllerWrapper(dataController.tableStats));

// Protobuf test
router.get('/proto', asyncControllerWrapper(dataController.testProto));

module.exports = router;