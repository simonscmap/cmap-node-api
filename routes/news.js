const router = require("express").Router();
const newsController = require("../controllers/news/");
// const passport = require("../middleware/passport");
// const checkAdminAuth = require("../middleware/checkAdminAuth");
const {
  contentTypes,
  ensureContentType,
} = require("../middleware/ensureContentType");
const asyncControllerWrapper = require("../errorHandling/asyncControllerWrapper");

router.get("/list", asyncControllerWrapper(newsController.list));

router.post(
  "/create",
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.create)
);

router.post(
  "/publish",
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.publish)
);

router.post(
  "/delete",
  ensureContentType(contentTypes.json),
  asyncControllerWrapper(newsController.delete)
);



module.exports = router;
