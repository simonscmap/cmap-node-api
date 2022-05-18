const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/signOut");

const standardCookieOptions = {
  // secure: true,
};

const jwtCookieOptions = {
  ...standardCookieOptions,
  httpOnly: true,
};

// Deletes http-only cookie (this cannot be done by client-side javascript)
module.exports = async (req, res) => {
  res.clearCookie("UserInfo");
  res.clearCookie("jwt", jwtCookieOptions);
  log.trace("user signed out");
  return res.end();
};
