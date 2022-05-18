const jwt = require("jsonwebtoken");

const jwtConfig = require("../../config/jwtConfig");
const UnsafeUser = require("../../models/UnsafeUser");

// const initializeLogger = require("../../log-service");
// const log = initializeLogger("controllers/user");

const standardCookieOptions = {
  // secure: true,
};

const jwtCookieOptions = {
  ...standardCookieOptions,
  httpOnly: true,
};

// Sends JWT http-only cookie
module.exports = async (req, res) => {
  // If requests authenticates we sent a cookie with basic user info, and
  // and httpOnly cookie with the JWT.
  let user = new UnsafeUser(req.user);

  // TODO stringify can throw, but that case is not handled here
  res.cookie("UserInfo", JSON.stringify(new UnsafeUser(req.user).makeSafe()), {
    ...standardCookieOptions,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 2),
  });

  res.cookie(
    "jwt",
    await jwt.sign(user.getJWTPayload(), jwtConfig.secret, { expiresIn: "2h" }),
    { ...jwtCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2) }
  );

  return res.json(true);
};
