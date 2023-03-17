const router = require("express").Router();
// const process = require("process");
const createNewLogger = require("../log-service");
const log = createNewLogger().setModule("routes/webApp.js");

const sendSPA = (req, res, next) => {
  log.trace('sending spa')
  res.sendFile("/public/app.html", { root: process.cwd() }, (err) => {
    if (err) {
      next(err);
    } else {
      next();
    }
  });
};

router.get("/", sendSPA);
router.get("/catalog", sendSPA);
router.get("/visualization", sendSPA);
router.get("/visualization/charts", sendSPA);
router.get("/visualization/cruises", sendSPA);
router.get("/datasubmission/guide", sendSPA);
router.get("/datasubmission/validationtool", sendSPA);
router.get("/datasubmission/userdashboard", sendSPA);
router.get("/datasubmission/admindashboard", sendSPA);
router.get("/documentation", sendSPA);
router.get("/about", sendSPA);
router.get("/contact", sendSPA);
router.get("/apikeymanagement", sendSPA);
router.get("/choosepassword", sendSPA);
router.get("/profile", sendSPA);
router.get("/register", sendSPA);
router.get("/forgotpass", sendSPA);
router.get("/education", sendSPA);

// Usage metrics logging
router.use((req, res, next) => {
  log.trace('save call details');
  req.cmapApiCallDetails.save();
  next();
});

// catch-all error logging
// NOTE this must take 4 arguments
// see: http://expressjs.com/en/guide/using-middleware.html#middleware.error-handling
router.use((err, req, res, next) => {
  log.setReqId(req.requestId);
  log.error("an error occurred in the web app catch-all", {
    error: err,
    errorMessage: err.message,
    requestPath: `${req.baseUrl || ""}${req.path}`
  });
  res.sendStatus(500);
});

router.use((req, res, next) => {
  if (res.headersSent) {
    return;
  }
  log.info("returning on unmatched route", { originalUrl: req.originalUrl });
  res.sendFile("/public/app.html", { root: process.cwd() }, (err) => {
    if (err) {
      next(err);
    }
  });
});

module.exports = router;
