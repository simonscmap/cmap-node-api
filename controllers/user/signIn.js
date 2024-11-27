const jwt = require("jsonwebtoken");

const jwtConfig = require("../../config/jwtConfig");
const UnsafeUser = require("../../models/UnsafeUser");

const initializeLogger = require("../../log-service");
const moduleLogger = initializeLogger("controllers/user");

const standardCookieOptions = {
  // secure: true,
};

const jwtCookieOptions = {
  ...standardCookieOptions,
  httpOnly: true,
};

// Sends JWT http-only cookie
// NOTE: prior middleware handles the password match; by the time this controller
// runs, the user has been identified and authenticated
module.exports = async (req, res) => {
  const log = moduleLogger.setReqId (req.requestId);
  log.debug ('signing in user');

  // passport middleware has authenticated the user
  // we send a cookie with basic user info, and httpOnly cookie with the JWT
  const user = new UnsafeUser(req.user);

  // TODO stringify can throw, but that case is not handled here
  res.cookie("UserInfo", JSON.stringify(new UnsafeUser(req.user).makeSafe()), {
    ...standardCookieOptions,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 2),
  });

  const jwtPayload = jwt.sign(
    user.getJWTPayload(),
    jwtConfig.secret,
    { expiresIn: "2h" });

  const jwtOptions = {
    ...jwtCookieOptions,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 2)
  };

  res.cookie("jwt", jwtPayload, jwtOptions);

  log.info ('user has been logged in, responding with token', { userId: user.id });

  return res.json(true);
};
