const jwt = require('jsonwebtoken');

const jwtConfig = require('../../config/jwtConfig');
const UnsafeUser = require('../../models/UnsafeUser');
const templates = require('../../utility/email/templates');
const { sendServiceMail } = require('../../utility/email/sendMail');
const Future = require('fluture');

const initializeLogger = require('../../log-service');
const log = initializeLogger('controllers/user/forgotPassword');

// Sends forgot password email to registered email address
module.exports = async (req, res) => {
  // Accepts post with email address, send forgotten password email with JWT in link to reset
  // TODO unhandled failure case
  log.info('initiating password reset', { providedEmail: req.body.email });

  let user = await UnsafeUser.getUserByEmail(req.body.email);

  if (!user || !user.email) {
    log.error(
      'failed to initiate password reset: unable to get user, or find user email',
      { providedEmail: req.body.email },
    );
    return res.sendStatus(200);
  }

  let token = jwt.sign(user.getJWTPayload(), jwtConfig.secret, {
    expiresIn: 60 * 30,
  });

  let content = templates.userResetPassword({ jwt: token });

  let subject = 'CMAP Password Reset Request';

  let args = {
    recipient: user.email,
    subject,
    content,
  };

  let sendMailFuture = sendServiceMail(args);

  let reject = (e) => {
    log.error('failed to send password reset email', {
      recipient: user.email,
      error: e,
    });
    res.status(500).send('error sending password reset email');
  };

  let resolve = () => {
    log.info('email sent', { recipient: user.email, subject });
    res.sendStatus(200);
  };

  // execute the send function
  // see https://github.com/fluture-js/Fluture#fork
  Future.fork(reject)(resolve)(sendMailFuture);
};
