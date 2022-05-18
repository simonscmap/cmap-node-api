const UnsafeUser = require("../../models/UnsafeUser");
const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/changeEmail");

const standardCookieOptions = {
  // secure: true,
};

module.exports = async (req, res) => {
  let user = new UnsafeUser({ ...req.user, email: req.body.email });
  try {
    await user.updateEmail();

    // TODO we should send an email notification....

    res.cookie("UserInfo", JSON.stringify(user.makeSafe()), {
      ...standardCookieOptions,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 2),
    });

    return res.sendStatus(200);
  } catch (e) {
    log.error("error with query to change email", { error: e });
    if (e.code === "EREQUEST") {
      return res.sendStatus(409);
    }
    return res.sendStatus(500);
  }
};
