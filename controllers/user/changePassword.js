const UnsafeUser = require('../../models/UnsafeUser');
const initializeLogger = require('../../log-service');
const log = initializeLogger('controllers/user/changePassword');

// Endpoint for user profile self-update password
module.exports = async (req, res) => {
  let user = new UnsafeUser({ ...req.user, password: req.body.newPassword });
  // TODO unhandled failure case
  let result = await user.updatePassword();

  if (!result.rowsAffected || !result.rowsAffected[0]) {
    // TODO does this check really signal a bad request?
    log.error('failed to update password', { userId: user.id });
    return res.sendStatus(400);
  } else {
    log.info('success updating password', { userId: user.id });
    return res.sendStatus(200);
  }
};
