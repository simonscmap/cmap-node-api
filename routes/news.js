const router = require("express").Router();
const newsController = require("../controllers/news/");
const passport = require("../middleware/passport");
const checkAdminAuth = require("../middleware/checkAdminAuth");

const {
  contentTypes,
  ensureContentType,
} = require("../middleware/ensureContentType");
const asyncControllerWrapper = require("../errorHandling/asyncControllerWrapper");

let passportMethods = ["headerapikey", "jwt"];
let passportOptions = { session: false };

router.get("/list", asyncControllerWrapper(newsController.list));

router.post(
  "/create",
  passport.authenticate(passportMethods, passportOptions),
  checkAdminAuth,
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.create)
);

router.post(
  "/publish",
  passport.authenticate(passportMethods, passportOptions),
  checkAdminAuth,
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.publish)
);

router.post(
  "/preview",
  passport.authenticate(passportMethods, passportOptions),
  checkAdminAuth,
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.preview)
);

router.post(
  "/draft",
  passport.authenticate(passportMethods, passportOptions),
  checkAdminAuth,
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.draft)
);

router.post(
  "/unpublish",
  passport.authenticate(passportMethods, passportOptions),
  checkAdminAuth,
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.unpublish)
);

router.post(
  "/feature",
  passport.authenticate(passportMethods, passportOptions),
  checkAdminAuth,
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.feature)
);

router.post(
  "/update",
  passport.authenticate(passportMethods, passportOptions),
  checkAdminAuth,
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.update)
);

router.post(
  "/updateRanks",
  passport.authenticate(passportMethods, passportOptions),
  checkAdminAuth,
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.updateRanks)
);

module.exports = router;
