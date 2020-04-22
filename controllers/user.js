const jwt = require('jsonwebtoken');
const uuidv1 = require('uuid/v1');
const sql = require('mssql');
const {OAuth2Client} = require('google-auth-library');
const base64url = require('base64-url')

const jwtConfig = require('../config/jwtConfig');
const UnsafeUser = require('../models/UnsafeUser');
const userDBConfig = require ('../config/dbConfig').userTableConfig;
const awaitableEmailClient = require('../utility/emailAuth');
const emailTemplates = require('../utility/emailTemplates');

const apiKeyTable = 'tblApi_Keys'

const cmapClientID = '739716651449-7d1e8iijue6srr9l5mi2iogp982sqoa0.apps.googleusercontent.com';

const standardCookieOptions = {
    // secure: true,
}

const jwtCookieOptions = {
    ...standardCookieOptions,
    httpOnly: true
}

exports.signup = async (req, res, next) => {
    // Registers a new user.
    let newUser = new UnsafeUser(req.body);
    let signupResult = await newUser.saveAsNew();
    if(!(signupResult.rowsAffected && signupResult.rowsAffected[0] > 0)){
        res.sendStatus(400);
        return next();
    }

    let signedUpUser = await UnsafeUser.getUserByEmail(req.body.email);

    let emailClient = await awaitableEmailClient;
    
    let token = jwt.sign(signedUpUser.getJWTPayload(), jwtConfig.secret, {expiresIn: 60 * 60 * 24});
    
    let content = emailTemplates.confirmEmail(token);
    let message =
        "From: 'me'\r\n" +
        "To: " + newUser.email + "\r\n" +
        "Subject: Simons CMAP\r\n" +
        "Content-Type: text/html; charset='UTF-8'\r\n" +
        "Content-Transfer-Encoding: base64\r\n\r\n" +
        content;

    let raw = base64url.encode(message);

    let result = await emailClient.users.messages.send({
        userId: 'me',
        resource: {
            raw
        }
    })

    console.log(result);

    res.sendStatus(200);
    return next();
 }

 exports.signin = async (req, res, next) => {
    // If requests authenticates we sent a cookie with basic user info, and
    // and httpOnly cookie with the JWT.
    let user = new UnsafeUser(req.user);
    res.cookie('UserInfo', JSON.stringify(new UnsafeUser(req.user).makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
    res.cookie('jwt', await jwt.sign(user.getJWTPayload(), jwtConfig.secret, {expiresIn:'2h'}), {...jwtCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
    
    res.json(true);
    next();
}

exports.validate = async(req, res, next) => {
    // Confirms uniqueness of username and password.
    let unsafeUser = new UnsafeUser(req.body);
    res.json(await unsafeUser.validateUsernameAndEmail());
    next();
}

exports.signout = async(req, res, next) => {
    res.clearCookie('UserInfo');
    res.clearCookie('jwt', jwtCookieOptions)
    res.end();
    next();
}

exports.generateApiKey = async(req, res, next) => {
    let apiKey = uuidv1();
    let pool = await new sql.ConnectionPool(userDBConfig).connect();
    let request = await new sql.Request(pool);
    request.input('description', sql.NVarChar, req.query.description);
    let query = `INSERT INTO ${apiKeyTable} (Api_Key, Description, User_ID) VALUES ('${apiKey}', @description, ${req.cmapApiCallDetails.userID})`;
    await request.query(query);
    res.json(true);
    next();
}

exports.retrieveApiKeys = async(req, res, next) => {
    let apiKeys = await UnsafeUser.getApiKeysByUserID(req.cmapApiCallDetails.userID);
    res.json({keys: apiKeys})
    next();
}

exports.googleAuth = async(req, res, next) => {
    const client = new OAuth2Client(cmapClientID);
    const { userIDToken } = req.body;
    const ticket = await client.verifyIdToken({
        idToken: userIDToken,
        audience: cmapClientID
    })

    // our app client ID, user unique google ID, user email, first, last
    const { aud, sub: googleID, email, given_name: firstName, family_name: lastName } = ticket.payload;

    if(aud !== cmapClientID){
        return next();
    }

    // User already has a google ID associated with their account
    var googleIDUser = await UnsafeUser.getUserByGoogleID(googleID);
    
    if(googleIDUser) {
        let user = new UnsafeUser(googleIDUser);
        res.cookie('UserInfo', JSON.stringify(user.makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
        res.cookie('jwt', await jwt.sign(googleIDUser.getJWTPayload(), jwtConfig.secret, {expiresIn:'2h'}), {...jwtCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
        res.json(true);
        return next();
    }

    // User has an account but has no associated google ID
    var existingUser = await UnsafeUser.getUserByEmail(email);

    if(existingUser){
        let user = new UnsafeUser({...existingUser, googleID});
        let result = await user.attachGoogleIDToExistingUser();

        res.cookie('UserInfo', JSON.stringify(user.makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
        res.cookie('jwt', await jwt.sign(user.getJWTPayload(), jwtConfig.secret, {expiresIn:'2h'}), {...jwtCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
        res.json(true);
        return next();
    }
    // New user
    let user = new UnsafeUser({
        googleID,
        email,
        firstName,
        lastName,
        username: email
    });

    let result = await user.saveAsNew();

    res.cookie('UserInfo', JSON.stringify(user.makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
    res.cookie('jwt', await jwt.sign(user.getJWTPayload(), jwtConfig.secret, {expiresIn:'2h'}), {...jwtCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
    res.json(true);

    return next();
}

exports.updateInfo = async(req, res, next) => {
    let user = new UnsafeUser({...req.user, ...req.body.userInfo});
    let result = await user.updateUserProfile();
    if(!result.rowsAffected || !result.rowsAffected[0]) {
        return res.sendStatus(400);
    }
    res.cookie('UserInfo', JSON.stringify(user.makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
    return res.sendStatus(200);
}

exports.forgotPassword = async(req, res, next) => {
    // Accepts post with email address, send forgotten password email with JWT in link to reset
    let user = new UnsafeUser(await UnsafeUser.getUserByEmail(req.body.email));
    console.log(req.body.email);
    if(!user || !user.email) {
        return res.sendStatus(200);
    }
    console.log(user);

    let token = await jwt.sign(user.getJWTPayload(), jwtConfig.secret, {expiresIn: 60 * 30});

    let emailClient = await awaitableEmailClient;
    let content = emailTemplates.forgotPassword(token, user.username);
    let message =
        "From: 'me'\r\n" +
        "To: " + user.email + "\r\n" +
        "Subject: Simons CMAP Password\r\n" +
        "Content-Type: text/html; charset='UTF-8'\r\n" +
        "Content-Transfer-Encoding: base64\r\n\r\n" +
        content;

    let raw = base64url.encode(message);

    let result = await emailClient.users.messages.send({
        userId: 'me',
        resource: {
            raw
        }
    })

    res.sendStatus(200);
    return next();
}

exports.contactUs = async(req, res, next) => {
    let payload = req.body;

    let emailClient = await awaitableEmailClient;
    let content = emailTemplates.contactUs(payload);
    let message =
        "From: 'me'\r\n" +
        "To: simonscmap@uw.edu\r\n" +
        "Subject: Message from Simons CMAP User\r\n" +
        // "Content-Type: text/html; charset='UTF-8'\r\n" +
        // "Content-Transfer-Encoding: base64\r\n\r\n" +
        content;

    let raw = base64url.encode(message);

    try {
        let result = await emailClient.users.messages.send({
            userId: 'me',
            resource: {
                raw
            }
        })
    
        res.sendStatus(200);
    } catch(e) {
        res.sendStatus(400);
    }

    return next();
}

exports.choosePassword = async(req, res, next) => {
    // Accept post with jwt and new pass, hash and set password
    let payload;
    try{
        payload = await jwt.verify(req.body.token, jwtConfig.secret);
    } catch {
        res.sendStatus(400);
        return next();
    }

    let password = req.body.password;
    let user = new UnsafeUser({id: payload.sub, password});
    let result = await user.updatePassword();

    if(result.rowsAffected && result.rowsAffected[0] > 0){
        res.sendStatus(200);
        return next();
    } else {
        console.log('rowsAffected fail')
        res.sendStatus(400);
        return next();
    }
}

exports.changeEmail = async(req, res, next) => {
    let user = new UnsafeUser({...req.user, email: req.body.email});
    try{
        let result = await user.updateEmail();
        res.cookie('UserInfo', JSON.stringify(user.makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
        return res.sendStatus(200);
    } catch(e) {
        if(e.code === 'EREQUEST'){
            return res.sendStatus(409);
        }
        res.sendStatus(400);
    }
    // if(!result.rowsAffected || !result.rowsAffected[0]) return res.sendStatus(400);
}

exports.changePassword = async(req, res, next) => {
    let user = new UnsafeUser({...req.user, password: req.body.newPassword});
    let result = await user.updatePassword();
    if(!result.rowsAffected || !result.rowsAffected[0]) return res.sendStatus(400);
    return res.sendStatus(200);
}