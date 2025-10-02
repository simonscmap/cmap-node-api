const passport = require('./passport');
const initializeLogger = require('../log-service');
const authMethodMapping = require('../config/authMethodMapping');

const moduleLogger = initializeLogger('middleware/optionalAuth');

/**
 * Optional authentication middleware factory
 *
 * Attempts to authenticate using JWT and API Key strategies but does NOT
 * block the request if authentication fails. Instead, it continues to the
 * next middleware, allowing controllers to provide different responses
 * based on authentication status.
 *
 * If authentication succeeds:
 * - req.user is populated with the authenticated user
 * - req.cmapApiCallDetails is updated with auth method and user ID
 *
 * If authentication fails:
 * - req.user remains undefined
 * - Request continues without error response
 *
 * @returns {Function} Express middleware function
 */
module.exports = function optionalAuth() {
  return function (req, res, next) {
    const log = moduleLogger.setReqId(req.requestId);
    log.info('attempting optional authentication');

    // Use custom callback form of passport.authenticate to prevent automatic 401 response
    passport.authenticate(
      ['jwt', 'headerapikey'],
      { session: false },
      function (err, user, info) {
        if (err) {
          log.error('error during optional authentication', { error: err });
          // Continue despite error - don't block the request
          return next();
        }

        if (user) {
          log.info('optional authentication succeeded', {
            userId: user.id,
            authMethod: req.cmapApiCallDetails
              ? req.cmapApiCallDetails.authMethod
              : 'unknown',
          });
          // Attach user to request
          req.user = user;
        } else {
          log.info('optional authentication failed, continuing as unauthenticated', {
            info,
          });
          // No user found, but continue anyway
        }

        // Continue to next middleware regardless of authentication result
        next();
      },
    )(req, res, next);
  };
};