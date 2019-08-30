const jwt = require('jsonwebtoken');
const uuidv1 = require('uuid/v1');
const sql = require('mssql');

const jwtConfig = require('../config/jwtConfig');
const UnsafeUser = require('../models/UnsafeUser');
const userDBConfig = require ('../config/dbConfig').userTableConfig;

const apiKeyTable = 'tblApi_Keys'

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
    await newUser.saveAsNew();
    res.json(true);
    next();
 }

 exports.signin = async (req, res, next) => {
    // If requests authenticates we sent a cookie with basic user info, and
    // and httpOnly cookie with the JWT.
    const jwtPayload = {
        iss: "Simons CMAP",
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
