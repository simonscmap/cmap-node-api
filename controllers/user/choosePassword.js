const jwt = require("jsonwebtoken");
const jwtConfig = require("../../config/jwtConfig");
const UnsafeUser = require("../../models/UnsafeUser");
const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/choosePassword");

// Endpoint for forgot password reset form
module.exports = async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.body.token, jwtConfig.secret);
  } catch (e) {
    log.error("error verifying jwt");
    return res.sendStatus(400);
  }

  let password = req.body.password;
  // TODO unhandled failure case
  let user = new UnsafeUser({ id: payload.sub, password });
  let result = await user.updatePassword();

  if (result.rowsAffected && result.rowsAffected[0] > 0) {
    log.info ("successfully updated user password", { userId: user.id });
    return res.sendStatus(200);
  } else {
    log.error("error updating password: failed rows affected check", { userId: user.id })
    return res.sendStatus(500);
  }
};
