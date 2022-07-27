const router = require("express").Router();
const multer = require("multer");
const passport = require("../middleware/passport");
const upload = multer();
const userRoutes = require("./user");
const dataRoutes = require("./data");
const catalogRoutes = require("./catalog");
const communityRoutes = require("./community");
const dataSubmissionRoutes = require("./dataSubmission");
const createNewLogger = require("../log-service");

const log = createNewLogger().setModule("routes/apiRouter.js");

let passportMethods = ["headerapikey", "jwt"];
let passportOptions = { session: false };

router.use("/user", userRoutes);
router.use("/data", dataRoutes);
router.use("/catalog", catalogRoutes);
router.use("/community", communityRoutes);
router.use(
  "/datasubmission",
  passport.authenticate(passportMethods, passportOptions),
  upload.any(),
  dataSubmissionRoutes
);

// catch-all error logging
// NOTE this must take 4 arguments
// see: http://expressjs.com/en/guide/using-middleware.html#middleware.error-handling
router.use((err, req, res, next) => {
  log.error("an error occurred in the api catch-all", err);
  // sometimes an error will occur AFTER a response has been sent,
  // in which case, we should not attempt to send another response
  if (res.headersSent) {
    return;
  }
  res.sendStatus(500);
});

router.use((req, res) => {
  if (res.headersSent) {
    return;
  }
  log.info("returning 404 from api", { originalUrl: req.originalUrl })
  res.sendStatus(404);
});

module.exports = router;
