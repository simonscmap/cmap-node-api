const router = require("express").Router();
const passport = require("../middleware/passport");

const dataController = require("../controllers/data");
const queryAnalysis = require("../middleware/queryAnalysis");
const checkQuerySize = require("../middleware/checkQuerySize");
const candidateAnalysis = require("../utility/router/routerMiddleware")
const { routeQueryFromMiddleware } = require("../utility/router/router");

const asyncControllerWrapper = require("../errorHandling/asyncControllerWrapper");
const wrap = asyncControllerWrapper;

// Custom query statement route
router.get(
  "/query-old",
  passport.authenticate(["headerapikey", "jwt", "guest"], { session: false }),
  asyncControllerWrapper(dataController.customQuery)
);

// Custom query statement route
router.get(
  "/query",
  passport.authenticate(["headerapikey", "jwt", "guest"], { session: false }),

  // apply query modifiers
  wrap(dataController.queryModifiers),

  // analyze query
  wrap(queryAnalysis),

  // calculate targets
  wrap(candidateAnalysis),

  // regulate query size
  wrap(checkQuerySize),

  // execute
  wrap(routeQueryFromMiddleware)
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
