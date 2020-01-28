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

const iss = "Simons CMAP";

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
    let emailClient = await awaitableEmailClient;
    let token = jwt.sign({sub: newUser.email}, jwtConfig.secret, {expiresIn: 60 * 60 * 24});
    
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

    res.sendStatus(200);
    return next();
 }

 exports.signin = async (req, res, next) => {
    // If requests authenticates we sent a cookie with basic user info, and
    // and httpOnly cookie with the JWT.
    const jwtPayload = {
        iss,
        sub: req.user.email,
    }
    res.cookie('UserInfo', JSON.stringify(new UnsafeUser(req.user).makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
    res.cookie('jwt', await jwt.sign(jwtPayload, jwtConfig.secret, {expiresIn:'2h'}), {...jwtCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
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
    // const jwtPayload = {
    //     iss: "Simons CMAP",
    //     sub: req.user.email,
    // }
    const client = new OAuth2Client(cmapClientID);
    const { userIDToken } = req.body;
    const ticket = await client.verifyIdToken({
        idToken: userIDToken,
        audience: cmapClientID
    })

    // our app client ID, user unique google ID, user email, first, last
    const { aud, sub: googleID, email, given_name: firstName, family_name: lastName } = ticket.payload;

    if(aud !== cmapClientID){
        console.log('aud mismatch');
        return next();
    }

    // User already has a google ID associated with their account
    var googleIDUser = await UnsafeUser.getUserByGoogleID(googleID);
    
    if(googleIDUser) {
        let user = new UnsafeUser(googleIDUser);
        let jwtPayload = {iss, sub: user.email};
        res.cookie('UserInfo', JSON.stringify(user.makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
        res.cookie('jwt', await jwt.sign(jwtPayload, jwtConfig.secret, {expiresIn:'2h'}), {...jwtCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
        res.json(true);
        return next();
    }

    // User has an account but has no associated google ID
    var existingUser = await UnsafeUser.getUserByEmail(email);

    if(existingUser){
        let user = new UnsafeUser({...existingUser, googleID});
        let result = await user.attachGoogleIDToExistingUser();

        let jwtPayload = {iss, sub: user.email};
        res.cookie('UserInfo', JSON.stringify(user.makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
        res.cookie('jwt', await jwt.sign(jwtPayload, jwtConfig.secret, {expiresIn:'2h'}), {...jwtCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
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
    let jwtPayload = {iss, sub: user.email};

    res.cookie('UserInfo', JSON.stringify(user.makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
    res.cookie('jwt', await jwt.sign(jwtPayload, jwtConfig.secret, {expiresIn:'2h'}), {...jwtCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
    res.json(true);

    return next();
}

exports.updateInfo = async(req, res, next) => {
    let user = new UnsafeUser({...req.user, ...req.body.userInfo});
    let result = await user.updateUserProfile();
    
    res.cookie('UserInfo', JSON.stringify(user.makeSafe()), {...standardCookieOptions, expires: new Date(Date.now() + 1000 * 60 * 60 * 2)});
    res.json(true);
}

exports.forgotPassword = async(req, res, next) => {
    // Accepts post with email address, send forgotten password email with JWT in link to reset
    let user = new UnsafeUser(await UnsafeUser.getUserByEmail(req.body.email));
    if(!user) {
        return res.sendStatus(200);
    }

    let jwtPayload = {iss, sub: user.email};
    let token = await jwt.sign(jwtPayload, jwtConfig.secret, {expiresIn: 60 * 30});

    let emailClient = await awaitableEmailClient;
    let content = emailTemplates.forgotPassword(token, user.userName);
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

// exports.confirmEmail = async(req, res, next) => {
//     // Accept post with email address, check for user, send confirm email with jwt to set password
//     let user = new UnsafeUser(await UnsafeUser.getUserByEmail(req.body.email));
//     if(!user) {
//         return res.sendStatus(200);
//     }

//     let jwtPayload = {iss, sub: user.email};
//     let token = await jwt.sign(jwtPayload, jwtConfig.secret, {expiresIn: 6 * 60 * 24});
//     console.log(token);
//     let content = emailTemplates.confirmEmail(token);
//     let message =
//         "From: 'me'\r\n" +
//         "To: " + req.body.email + "\r\n" +
//         "Subject: Simons CMAP\r\n" +
//         "Content-Type: text/html; charset='UTF-8'\r\n" +
//         "Content-Transfer-Encoding: base64\r\n\r\n" +
//         content;

//     let raw = base64url.encode(message);

//     let result = await emailClient.users.messages.send({
//         userId: 'me',
//         resource: {
//             raw
//         }
//     })

//     res.sendStatus(200);
//     return next();
// }

exports.choosePassword = async(req, res, next) => {
    // Accept post with jwt and new pass, has and set password
    let payload;
    try{
        payload = await jwt.verify(req.body.token, jwtConfig.secret);
    } catch {
        res.sendStatus(400);
        return next();
    }
    console.log(payload);
    let password = req.body.password;
    let user = new UnsafeUser({email: payload.sub, password});
    let result = await user.updatePassword();
    console.log(result);
    if(result.rowsAffected && result.rowsAffected[0] > 0){
        res.sendStatus(200);
        return next();
    } else {
        res.sendStatus(400);
        return next();
    }
}