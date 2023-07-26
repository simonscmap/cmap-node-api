const router = require("express").Router();
const passport = require("../middleware/passport");

const dataController = require("../controllers/data");

const asyncControllerWrapper = require("../errorHandling/asyncControllerWrapper");

// Custom query statement route
router.get(
  "/query",
  passport.authenticate(["headerapikey", "jwt", "guest"], { session: false }),
  asyncControllerWrapper(dataController.customQuery)
);

// Stored procedure route
router.get(
  "/sp",
  passport.authenticate(["headerapikey", "jwt", "guest"], { session: false }),
  asyncControllerWrapper(dataController.storedProcedure)
);

router.get(
  "/ancillary-datasets",
  asyncControllerWrapper(dataController.ancillaryDatasets)
);

// Get list of tables that are continuously ingested
router.get(
  "/ci-datasets",
  asyncControllerWrapper(dataController.ciDatasets)
);

// Get a map of tables with dataset features
router.get(
  "/dataset-features",
  asyncControllerWrapper(dataController.datasetFeatures)
);

// Get list of cruises
router.get("/cruiselist", asyncControllerWrapper(dataController.cruiseList));

// Get cruise trajectory
router.get(
  "/cruisetrajectory",
  asyncControllerWrapper(dataController.cruiseTrajectory)
);

// Table stats
router.get("/tablestats", asyncControllerWrapper(dataController.tableStats));

// Protobuf test
router.get("/proto", asyncControllerWrapper(dataController.testProto));

module.exports = router;
