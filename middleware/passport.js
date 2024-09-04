const jwt = require('jsonwebtoken');
const sql = require('mssql');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const JwtStrategy = require('passport-jwt').Strategy;
const HeaderApiKeyStrategy = require('passport-headerapikey').HeaderAPIKeyStrategy;
const LocalStrategy = require('passport-local').Strategy;
const CustomStrategy = require('passport-custom').Strategy;

const secret = require('../config/jwtConfig').secret;
const UnsafeUser = require('../models/UnsafeUser');
const authMethodMapping = require('../config/authMethodMapping');
const GuestUser = require('../models/GuestUser');
const pools = require('../dbHandlers/dbPools');
const guestTokenHashFromRequest = require('../utility/guestTokenHashFromRequest');
const initializeLogger = require("../log-service");

const log = initializeLogger ('middleware/passport');

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
  try {
    const userInfo = await UnsafeUser.getUserByUsername(username);
    const unsafeUser = new UnsafeUser(userInfo);
    bcrypt.compare (password, unsafeUser.password, function (err, isMatch) {
      if (isMatch) {
        log.debug ('local verification matched password', null)
        req.cmapApiCallDetails.authMethod = authMethodMapping.local;
        req.cmapApiCallDetails.userID = unsafeUser.id;
        return done (null, unsafeUser.makeSafe());
      } else {
        log.debug ('local verification failed to match password', { error: err });
        return done (null, false);
      }
    })
  } catch (e) {
    log.error('error attempting to use local strategy for login', { username, error: e });
    return done (null, false);
  }
};
const localStrategy = new LocalStrategy (localStrategyOptions, localVerification);

// Protects user signin route. Finds user and checks password
passport.use(localStrategy);

  // Confirms JWT was signed using out secret
passport.use(new JwtStrategy(
    jwtExtractorOpts,
    async function(req, jwtPayload, done){
        req.cmapApiCallDetails.authMethod = authMethodMapping.jwt;

        try {
            let unsafeUser = new UnsafeUser(await UnsafeUser.getUserByID(jwtPayload.sub));
            req.cmapApiCallDetails.userID = unsafeUser.id;
            return done(null, unsafeUser);
        } catch {
            return done(null, false)
        }
    }
))

// Confirms API key belonds to registered user
passport.use(new HeaderApiKeyStrategy(
    headerApiKeyOpts,
    true,
    async function(apiKey, done, req){
        try {
            let unsafeUser = new UnsafeUser(await UnsafeUser.getUserByApiKey(apiKey));
            req.cmapApiCallDetails.authMethod = authMethodMapping.apiKey;
            req.cmapApiCallDetails.userID = unsafeUser.id;
            req.cmapApiCallDetails.apiKeyID = unsafeUser.apiKeyID;
            return done(null, unsafeUser.makeSafe());
        } catch (e){
            return done(null, false);
        }
    }
    ))

module.exports = passport;
