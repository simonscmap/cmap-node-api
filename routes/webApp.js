const router = require("express").Router();
// const process = require("process");
const createNewLogger = require("../log-service");
const log = createNewLogger().setModule("routes/webApp.js");

const sendSPA = (req, res, next) => {
  log.trace('sending spa')
  res.sendFile("/public/app.html", { root: process.cwd() }, (err) => {
    if (err) {
      return next(err);
    } else {
      return next();
    }
  });
};

const saveCall = (req, res, next) => {
  res.on('finish', () => {
    req.cmapApiCallDetails.save(res, { caller: 'webApp' });
  });
  next();
};

// Usage metrics logging
router.use(saveCall);

router.get("/", sendSPA);
router.get("/catalog", sendSPA);
router.get("/catalog/cruises/:cruise", sendSPA);
router.get("/catalog/datasets/:dataset", sendSPA);
router.get("/visualization", sendSPA);
router.get("/visualization/charts", sendSPA);
router.get("/visualization/cruises", sendSPA);
router.get("/datasubmission/guide", sendSPA);
router.get("/datasubmission/validationtool", sendSPA); // deprecated, but don't 404
router.get("/datasubmission/submission-portal", sendSPA);
router.get("/datasubmission/userdashboard", sendSPA);
router.get("/datasubmission/admindashboard", sendSPA);
router.get("/datasubmission/nominate-data", sendSPA);
router.get("/documentation", sendSPA);
router.get("/about", sendSPA);
router.get("/contact", sendSPA);
router.get("/apikeymanagement", sendSPA);
router.get("/choosepassword", sendSPA);
router.get("/profile", sendSPA);
router.get("/register", sendSPA);
router.get("/forgotpass", sendSPA);
router.get("/education", sendSPA);
router.get("/gallery", sendSPA);
router.get("/gallery/getting-started-cruise-plan", sendSPA);
router.get("/gallery/getting-started-cruise-map", sendSPA);
router.get("/gallery/seaflow-time-series-decomposition", sendSPA);
router.get("/gallery/compare-sst-data", sendSPA);
router.get("/admin/news", sendSPA);

// catch-all error logging
// NOTE this must take 4 arguments
// see: http://expressjs.com/en/guide/using-middleware.html#middleware.error-handling
router.use((err, req, res, next) => {
  log.error("an error occurred in the web app catch-all", { error: err, requestPath: `${req.baseUrl || ""}${req.path}` });
  res.sendStatus(500);
  return next();
});

router.use((req, res, next) => {
  if (res.headersSent) {
    return;
  }
  if (req.originalUrl === '/favicon.ico') {
    return;
  }
  log.info("returning on unmatched route", {
    originalUrl: req.originalUrl,
    ip: req.headers["x-forwarded-for"]
      ? req.headers["x-forwarded-for"].split(",")[0]
      : req.ip || "None"
  });
  res.status(404).sendFile("/public/app.html", { root: process.cwd() }, (err) => {
    if (err) {
      next(err);
    }
    next();
  });
});

module.exports = router;
