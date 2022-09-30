const jwt = require("jsonwebtoken");
const jwtConfig = require("../../config/jwtConfig");
const UnsafeUser = require("../../models/UnsafeUser");
const templates = require("../../utility/email/templates");
const { sendServiceMail } = require("../../utility/email/sendMail");
const Future = require("fluture");

const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/signUp");

// Creates a new user in DB. Sends confirmation email
module.exports = async (req, res) => {
  // Registers a new user.
  log.info("initiating new user sign-up", { providedEmail: req.body.email });

  let newUser = new UnsafeUser(req.body);

  let signupResult;

  try {
    signupResult = await newUser.saveAsNew();
  } catch (e) {
    log.error("error saving new user", e);
    return res.sendStatus(500);
  }

  if (!(signupResult.rowsAffected && signupResult.rowsAffected[0] > 0)) {
    log.error("signup was unsuccessful: no rows affected", {
      user: newUser,
    });
    return res.sendStatus(500);
  }

  log.info("success creating new user record", {
    providedEmail: req.body.email,
  });

  let signedUpUser;

  try {
    signedUpUser = await UnsafeUser.getUserByEmail(req.body.email);
  } catch (e) {
    log.error("error retrieving user during signup", { error: e, newUser });
    return res.sendStatus(500);
  }

  log.info("sending new user sign-up confirmation email", {
    providedEmail: req.body.email,
  });

  // jwt payload is just `{ iss, sub }`
  let jwtPayload = signedUpUser.getJWTPayload();
  let token = jwt.sign(jwtPayload, jwtConfig.secret, {
    expiresIn: 60 * 60 * 24,
  });

  let args = {
    recipient: req.body.email,
    subject: "Simons CMAP: Confirm Account",
    content: templates.signupConfirmEmail({
      jwt: token,
      addressee: signedUpUser.firstName,
    }),
  };

  // send Future
  let sendF = sendServiceMail (args);

  let reject = (e) => {
    log.error("failed to send sign-up email; ensure token is valid", {
      recipient: args.recipient,
      error: e,
    });
    res.status(500).send("error sending sign-up confirmation email");
  };

  let resolve = () => {
    log.info("email sent", {
      recipient: args.recipient,
      subject: args.subject,
    });
    res.sendStatus(200);
  };

  // execute the send function
  // see https://github.com/fluture-js/Fluture#fork
  Future.fork (reject) (resolve) (sendF);
};
