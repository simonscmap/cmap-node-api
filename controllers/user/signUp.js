const jwt = require("jsonwebtoken");

const jwtConfig = require("../../config/jwtConfig");
const UnsafeUser = require("../../models/UnsafeUser");
const templates = require("../../utility/email/templates");
const sendMail = require("../../utility/email/sendMail");

const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/signUp");

// Creates a new user in DB. Sends confirmation email
module.exports = async (req, res) => {
  // Registers a new user.
  let newUser = new UnsafeUser(req.body);

  let signupResult;

  try {
    signupResult = await newUser.saveAsNew();
  } catch (e) {
    log.error("error saving new user", e);
    return res.sendStatus(500);
  }

  if (!(signupResult.rowsAffected && signupResult.rowsAffected[0] > 0)) {
    log.error("signup was unsuccessful: failed rows affected test", {
      user: newUser,
    });
    return res.sendStatus(500);
  }

  let signedUpUser;

  try {
    signedUpUser = await UnsafeUser.getUserByEmail(req.body.email);
  } catch (e) {
    log.error("error retrieving user during signup", { error: e, newUser });
    return res.sendStatus(500);
  }

  // jwt payload is just `{ iss, sub }`
  let jwtPayload = signedUpUser.getJWTPayload();
  let token = jwt.sign(jwtPayload, jwtConfig.secret, {
    expiresIn: 60 * 60 * 24,
  });

  let addressee = signedUpUser.firstName;

  let content = templates.signupConfirmEmail({ jwt: token, addressee });
  let subject = "Simons CMAP: Confirm Account";
  try {
    await sendMail(req.body.email, subject, content);
    return res.sendStatus(200);
  } catch (e) {
    log.error("error sending mail, check if token is valid", {
      error: e,
      result,
    });
    return res.sendStatus(500);
  }
};
