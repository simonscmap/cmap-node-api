const jwt = require("jsonwebtoken");

const jwtConfig = require("../../config/jwtConfig");
const UnsafeUser = require("../../models/UnsafeUser");
const templates = require("../../utility/email/templates");
const sendMail = require("../../utility/email/sendMail");

const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/forgotPassword");

// Sends forgot password email to registered email address
module.exports = async (req, res, next) => {
  // Accepts post with email address, send forgotten password email with JWT in link to reset
  // TODO unhandled failure case
  let user = new UnsafeUser(await UnsafeUser.getUserByEmail(req.body.email));

  if (!user || !user.email) {
    log.error(
      "failed to initiate password reset: unable to get user, or find user email",
      { providedEmail: req.body.email }
    );
    return res.sendStatus(200);
  }

  let token = jwt.sign(user.getJWTPayload(), jwtConfig.secret, {
    expiresIn: 60 * 30,
  });

  let content = templates.userResetPassword({ jwt: token });

  let subject = "CMAP Password Reset Request";

  try {
    sendMail(user.email, subject, content);
  } catch (e) {
    res.sendStatus(500);
    log.error("error sending password reset email", e);
    return;
  }

  res.sendStatus(200);
  return next();
};
