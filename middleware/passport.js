const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const HeaderApiKeyStrategy = require('passport-headerapikey').HeaderAPIKeyStrategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

const secret = require('../config/jwtConfig').secret;
const UnsafeUser = require('../models/UnsafeUser');
const authMethodMapping = require('../config/authMethodMapping');

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
passport.use(new LocalStrategy(localStrategyOptions,
    async function(req, username, password, done) {
        try{
            let unsafeUser = new UnsafeUser(await UnsafeUser.getUserByUsername(username));
            bcrypt.compare(password, unsafeUser.password, function (err, isMatch){
                if(isMatch) {
                    req.cmapApiCallDetails.authMethod = authMethodMapping.local;
                    req.cmapApiCallDetails.userID = unsafeUser.id;
                    return done(null, unsafeUser.makeSafe());
                }
                return done(null, false);
            })
        } catch (e) {
            return done(null, false);
        }
    }
  ));

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