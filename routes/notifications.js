/** Notifications Router
 *  This router provides apis for sending notifications to users
 *  who have subscribed to receive notifications for news, or
 *  for notifications related to specific datasets.
 *  See the Users router & controller for managing subscriptions
 */
const router = require("express").Router();
const controllers = require ("../controllers/notifications/");
const passport = require("../middleware/passport");
const checkAdminAuth = require("../middleware/checkAdminAuth");
const {
  contentTypes,
  ensureContentType,
} = require("../middleware/ensureContentType");
const asyncControllerWrapper = require("../errorHandling/asyncControllerWrapper");

let passportMethods = ["headerapikey", "jwt"];
let passportOptions = { session: false };

// history
router.get ("/history",
            passport.authenticate (passportMethods, passportOptions),
            checkAdminAuth,
            asyncControllerWrapper (controllers.history)
           );

// send
router.post ("/send",
             passport.authenticate (passportMethods, passportOptions),
             checkAdminAuth,
             ensureContentType (contentTypes.json),
             asyncControllerWrapper (controllers.send)
            );

module.exports = router;
