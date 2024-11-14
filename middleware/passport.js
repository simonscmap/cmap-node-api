const jwt = require('jsonwebtoken');
const sql = require('mssql');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const JwtStrategy = require('passport-jwt').Strategy;
const HeaderApiKeyStrategy = require('passport-headerapikey').HeaderAPIKeyStrategy;
const LocalStrategy = require('passport-local').Strategy;
const CustomStrategy = require('passport-custom').Strategy;
const notifyAdmin = require('../utility/email/notifyAdmin');

const secret = require('../config/jwtConfig').secret;
const UnsafeUser = require('../models/UnsafeUser');
const authMethodMapping = require('../config/authMethodMapping');
const GuestUser = require('../models/GuestUser');
const pools = require('../dbHandlers/dbPools');
const guestTokenHashFromRequest = require('../utility/guestTokenHashFromRequest');
const initializeLogger = require("../log-service");

const moduleLogger = initializeLogger ('middleware/passport');

const headerApiKeyOpts = { // Configure how passport identifies the API Key
    header: 'Authorization',
    prefix: 'Api-Key ',
}

const jwtExtractorOpts = { // Configure how passport extracts and verifies the JWT
    secretOrKey : secret,
    jwtFromRequest : (req) => {
        var token = null;
        if(req && req.cookies) token = req.cookies.jwt;
        return token;
    },
    passReqToCallback: true
}

const localStrategyOptions = {
    passReqToCallback: true
}

// Passport Strategies

// attempts to identify "authoritative" browsers (user agent contains "mozilla")
passport.use('browserOnly', new CustomStrategy(async(req, done) => {
    if(!req.useragent.isAuthoritative) return done(null, false);
    return done(null, new GuestUser());
}));

// identifies a valid guest token with uses remaining
passport.use('guest', new CustomStrategy(async(req, done) => {
    try{
        var token = req.cookies.guestToken;
        jwt.verify(token, secret); // throws an error on failure
        var { hash, id } = jwt.decode(token);

        var pool = await pools.userReadAndWritePool;
        var checkTokenRequest = new sql.Request(pool);
        checkTokenRequest.input('id', sql.Int, id);
        let checkTokenResult = await checkTokenRequest.query(`SELECT [Hash], [Times_Used] from [tblGuest_Tokens] WHERE ID = @id`);

        if(checkTokenResult.recordset[0].Times_Used > 9) return done(null, false);
        if(checkTokenResult.recordset[0].Hash !== guestTokenHashFromRequest(req) || guestTokenHashFromRequest(req) !== hash) return done(null, false);

        let incrementTokenUsesRequest = new sql.Request(pool);
        incrementTokenUsesRequest.input('id', sql.Int, id);
        incrementTokenUsesRequest.query(`UPDATE tblGuest_Tokens SET [Times_Used] = [Times_Used] + 1 WHERE ID = @id`);

        return done(null, new GuestUser());
    }

    catch(e) {
        return done(null, false);
    }
}));


const localVerification = async (req, username, password, done) => {
  const log = moduleLogger.setReqId(req.requestId);
  log.info ('attempting password login', { providedUsername: username });
  try {
    // getUserByUsername returns a new UnsafeUser
    let user = await UnsafeUser.getUserByUsername(username, log);

    if (!user) {
      // if no system username matches the login-provided username,
      // try it as the email address
      user = await UnsafeUser.getUserByEmail (username, log);
      if (user) {
        log.info ("user used email as username", { username, id: user.id });
      }
    }


    if (!user) {
      log.info ('cancelling login: no user with provided username found', { providedUsername: username });
      const text = `There was an attempt to login to the website that failed because the provided username "${username}" was not found in our system. A lookup for a user with the email "${username}" was also attempted without success.`;
      notifyAdmin ('Bad Username Login Attempt', text);
      return done (null, false);
    }

    bcrypt.compare (password, user.password, function (err, isMatch) {
      if (isMatch) {
        log.info ('password matched', { username, id: user.id });
        req.cmapApiCallDetails.authMethod = authMethodMapping.local;
        req.cmapApiCallDetails.userID = user.id;
        return done (null, user.makeSafe());
      } else {
        log.debug ('password did not match', { error: err, username, id: user.id });
        const text = `There was an attempt to login to the website with the username "${username}" that failed because the password was incorrect.`;
      notifyAdmin ('Bad Password Login Attempt', text);
        return done (null, false);
      }
    })
  } catch (e) {
    log.error('error attempting to use local strategy for login', { username, error: e });
    const text = `An attempt to login to the website with the username "${username}" failed due to an unexpected error: ${e.message}.`;
      notifyAdmin ('Error in Login Attempt', text);
    return done (null, false);
  }
};

const localStrategy = new LocalStrategy (localStrategyOptions, localVerification);

// Protects user signin route. Finds user and checks password
passport.use(localStrategy);

  // Confirms JWT was signed using out secret
passport.use(new JwtStrategy(
  jwtExtractorOpts,
  async function(req, jwtPayload, done) {
    req.cmapApiCallDetails.authMethod = authMethodMapping.jwt;
    const log = moduleLogger.setReqId (req.requestId);
    try {
      let unsafeUser = await UnsafeUser.getUserByID(jwtPayload.sub, log);
      req.cmapApiCallDetails.userID = unsafeUser.id;
      return done(null, unsafeUser);
    } catch {
      return done(null, false)
    }
  }
));

// Confirms API key belonds to registered user
passport.use(new HeaderApiKeyStrategy(
  headerApiKeyOpts,
  true,
  async function(apiKey, done, req) {
    const log = moduleLogger.setReqId (req.requestId);
    let unsafeUser = await UnsafeUser.getUserByApiKey(apiKey, log);
    if (unsafeUser) {
      req.cmapApiCallDetails.authMethod = authMethodMapping.apiKey;
      req.cmapApiCallDetails.userID = unsafeUser.id;
      req.cmapApiCallDetails.apiKeyID = unsafeUser.apiKeyID;
      return done(null, unsafeUser.makeSafe());
    } else {
      return done(null, false);
    }
  }
));

module.exports = passport;
