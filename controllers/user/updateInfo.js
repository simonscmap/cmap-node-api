const UnsafeUser = require("../../models/UnsafeUser");
const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/udpateInfo");

const standardCookieOptions = {
  // secure: true,
};

// Endpoint for user profile self update
module.exports = async (req, res) => {
  let user = new UnsafeUser({ ...req.user, ...req.body.userInfo });

  let result;
  try {
    result = await user.updateUserProfile();
  } catch (e) {
    log.error("error updating profile", { error: e });
    return res.sendStatus(500);
  }


  if (!result.rowsAffected || !result.rowsAffected[0]) {
    log.error("failed to update user info", { rowsAffected: result.rowsAffected, userId: user.id })
    return res.sendStatus(500);
  }
  res.cookie("UserInfo", JSON.stringify(user.makeSafe()), {
    ...standardCookieOptions,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 2),
  });
  return res.sendStatus(200);
};
