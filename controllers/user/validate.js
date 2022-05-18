const UnsafeUser = require("../../models/UnsafeUser");
const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/validate");

// Confirms unique username and email
module.exports = async (req, res) => {
  // Confirms uniqueness of username and password.
  let unsafeUser = new UnsafeUser(req.body);
  let result;
  try {
    result = await unsafeUser.validateUsernameAndEmail()
  } catch (e) {
    log.error("error validating uniqueness of username/email", { error: e, user: req.body });
    return res.sendStatus(500);
  }
  return res.json(result);
};
