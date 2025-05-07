const bcrypt = require('bcryptjs');
const sql = require('mssql');
const pools = require('../dbHandlers/dbPools');
const logService = require('../log-service');

const userTable = 'tblUsers';
const apiKeyTable = 'tblApi_Keys';
const iss = 'Simons CMAP';

const moduleLogger = logService('models/UnsafeUser');

// This is the general user class.
// Instances can include a password in some routes, hence "unsafe".
// Makesafe returns an object literal with partial information and no password.
module.exports = class UnsafeUser {
  constructor(userInfo) {
    this.firstName = userInfo.firstName || userInfo.FirstName || 'Guest';
    this.lastName = userInfo.lastName || userInfo.FamilyName || 'Guest';
    this.username =
      userInfo.userName || userInfo.Username || userInfo.username || 'Guest';
    this.password = userInfo.password || userInfo.Password || 'NoPass';
    this.email = userInfo.email || userInfo.Email || 'Guest';
    this.institute = userInfo.institute || userInfo.Institute || null;
    this.department = userInfo.department || userInfo.Department || null;
    this.country = userInfo.country || userInfo.Country || null;

    this.googleID = userInfo.googleID || userInfo.GoogleID || null;

    this.id = userInfo.UserID || userInfo.id || null;

    this.apiKey = userInfo.Api_Key || null;
    this.apiKeyID = userInfo.Api_Key_ID || userInfo.apiKeyID || null;
    this.isDataSubmissionAdmin =
      Boolean(userInfo.Is_Data_Submission_Admin) ||
      Boolean(userInfo.isDataSubmissionAdmin) ||
      false;
    this.isNewsSubscribed =
      Boolean(userInfo.News_Subscribed) || Boolean(userInfo.isNewsSubscribed);
  }

  static async getUserByUsername(username, log = moduleLogger) {
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);
    request.input('username', sql.NVarChar, username);

    let result;
    try {
      result = await request.query(
        `SELECT TOP 1 * FROM ${userTable} WHERE username = @username`,
      );
    } catch (e) {
      log.error('error attempting to get user by username', {
        error: e,
        username,
      });
      return false;
    }

    const userRecord =
      result &&
      result.recordset &&
      result.recordset.length &&
      result.recordset[0];

    if (userRecord) {
      log.info('success lookuing up user by username', {
        username,
        id: userRecord.UserID,
      });
      return new this(userRecord);
    } else {
      log.info('user lookup by username returned no match', { username });
      return false;
    }
  }

  // getUserByID is not used
  static async getUserByID(id, log = moduleLogger) {
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);
    request.input('id', sql.Int, id);

    let result;
    try {
      result = await request.query(
        `SELECT TOP 1 * FROM ${userTable} WHERE UserId = @id`,
      );
    } catch (e) {
      log.error('error looking up user by id', { id });
      return false;
    }

    const userRecord =
      result &&
      result.recordset &&
      result.recordset.length &&
      result.recordset[0];

    if (userRecord) {
      log.info('success looking up user by id', { id });
      return new this(userRecord);
    } else {
      log.warn('no user record found with id', { id });
      return false;
    }
  }

  static async getUserByEmail(email, log = moduleLogger) {
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);
    request.input('email', sql.NVarChar, email);

    let result;
    try {
      result = await request.query(
        `SELECT TOP 1 * FROM ${userTable} WHERE email = @email`,
      );
    } catch (e) {
      log.error('error attempting to lookup user by email', {
        error: e,
        providedEmail: email,
      });
      return false;
    }

    const userRecord =
      result &&
      result.recordset &&
      result.recordset.length &&
      result.recordset[0];

    if (userRecord) {
      log.info('sucessfully looked up user with email', {
        email,
        id: userRecord.UserID,
      });
      return new this(userRecord);
    } else {
      log.info('user lookup by email returned no match', {
        providedEmail: email,
      });
      return false;
    }
  }

  static async getUserByApiKey(key, log = moduleLogger) {
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);
    request.input('key', sql.NVarChar, key);

    let query = `SELECT TOP 1 *,${apiKeyTable}.ID as Api_Key_ID FROM ${userTable} JOIN ${apiKeyTable} on ${apiKeyTable}.User_ID = ${userTable}.UserID WHERE Api_Key = @key`;
    let result;
    try {
      result = await request.query(query);
    } catch (e) {
      log.error('error looking up user by api key', { key, error: e });
      return false;
    }

    const userRecord =
      result &&
      result.recordset &&
      result.recordset.length &&
      result.recordset[0];

    if (!userRecord) {
      log.info('user lookup by api key returned no match', { key });
      return false;
    } else {
      log.info('user lookup by api key succeeded', {
        key,
        id: userRecord.UserID,
      });
      return new this(userRecord);
    }
  }

  static async getUserByGoogleID(id, log = moduleLogger) {
    log.debug('attempting to get user by google id', { id });
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);

    request.input('id', sql.VarChar, id);

    let result;
    try {
      result = await request.query(
        `SELECT * FROM ${userTable} WHERE GoogleID = @id`,
      );
      log.debug('get user by google id result', { id, ...result });
    } catch (e) {
      log.error('error looking up user by googleId', { googleId: id });
    }

    if (!result.recordset.length) {
      log.info('no user found with given google id', { googleId: id });
      return false;
    }

    const record = result && result.recordset && result.recordset[0];
    const Email = record && record.Email;

    log.info('user succesfully found with given google id', {
      googleId: id,
      email: Email,
    });
    return new this(result.recordset[0]);
  }

  static async getApiKeysByUserID(id, log = moduleLogger) {
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);
    request.input('user_id', sql.Int, id);
    request.on('error', (err) => console.log(err));
    let result = await request.query(
      `SELECT Api_Key, Description from ${apiKeyTable} WHERE User_ID = @user_id`,
    );
    return result.recordset.length ? result.recordset : null;
  }

  makeSafe() {
    // Returns user object that can be sent to client
    let safeUser = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      department: this.department,
      institute: this.institute,
      country: this.country,
      id: this.id,
      username: this.username,
      isDataSubmissionAdmin: this.isDataSubmissionAdmin,
      isNewsSubscribed: this.isNewsSubscribed,
    };

    return safeUser;
  }

  // checks availability of username and email
  // returns FALSE if user is found, otherwise TRUE
  async validateUsernameAndEmail() {
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);
    request.input('username', sql.NVarChar, this.username);
    request.input('email', sql.NVarChar, this.email);

    let query = `SELECT * FROM ${userTable} WHERE Username = @username OR Email = @email`;

    let result = await request.query(query);
    if (result.recordset.length) return false;
    return true;
  }

  async saveAsNew(log = moduleLogger) {
    // Validates and saves user to db.
    log.info('saving new user', { email: this.email });
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);
    let hashedPassword =
      this.password === 'NoPass'
        ? 'NoPass'
        : await bcrypt.hash(this.password, 10);
    let query = `INSERT INTO ${userTable} (FirstName, FamilyName, Username, Password, Email, Institute, Department, Country, GoogleID) VALUES (@firstname, @lastname, @username, @password, @email, @institute, @department, @country, @googleid) SELECT SCOPE_IDENTITY()`;

    request.input('firstname', sql.NVarChar, this.firstName);
    request.input('lastname', sql.NVarChar, this.lastName);
    request.input('username', sql.NVarChar, this.username);
    request.input('password', sql.NVarChar, hashedPassword);
    request.input('email', sql.NVarChar, this.email);
    request.input('institute', sql.NVarChar, this.institute);
    request.input('department', sql.NVarChar, this.department);
    request.input('country', sql.NVarChar, this.country);
    request.input('googleid', sql.VarChar, this.googleID);

    let result;
    try {
      result = await request.query(query);
    } catch (e) {
      log.error('error saving new user', { error: e, email: this.email });
      return null;
    }
    log.info('saved new user', { email: this.email });
    return result;
  }

  // Use to associate a google ID with an existing account for first time google sign-on
  async attachGoogleIDToExistingUser(log = moduleLogger) {
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);

    let query = `UPDATE ${userTable} SET GoogleID = @googleid WHERE UserID = @id`;

    request.input('googleid', sql.VarChar, this.googleID);
    request.input('id', sql.Int, parseInt(this.id));

    try {
      await request.query(query);
    } catch (e) {
      log.error('attempt to attach googleId to user failed with error', {
        userId: this.id,
        error: e,
      });
      return [e];
    }
    log.info('attached googleId to user', { userId: this.id });
    return [];
  }

  // Update method for less-sensitive information shown on the front end user profile
  async updateUserProfile(log = moduleLogger) {
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);

    let query = `UPDATE ${userTable}
                 SET FirstName = @firstname,
                     FamilyName = @familyname,
                     Institute = @institute,
                     Department = @department,
                     Country = @country,
                     News_Subscribed = @newsSubscribed
                 WHERE UserID = @id`;

    request.input('firstname', sql.NVarChar, this.firstName);
    request.input('familyname', sql.NVarChar, this.lastName);
    request.input('institute', sql.NVarChar, this.institute);
    request.input('department', sql.NVarChar, this.department);
    request.input('country', sql.NVarChar, this.country);
    request.input('newsSubscribed', sql.Bit, this.isNewsSubscribed);
    // user id is stored as in integer
    request.input('id', sql.VarChar, `${this.id}`);

    let result;
    try {
      result = await request.query(query);
    } catch (e) {
      log.error('error while attempting to update user', {
        error: e,
        userId: this.id,
      });
    }
    log.info('successfully updated user', { userId: this.id });
    return result;
  }

  // Password update
  async updatePassword(log = moduleLogger) {
    // Updates password based on email
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);

    let hashedPassword = await bcrypt.hash(this.password, 10);

    let query = `UPDATE ${userTable} SET Password = @password WHERE UserID = @id`;

    request.input('password', sql.NVarChar, hashedPassword);
    request.input('id', sql.Int, this.id);

    let result;
    try {
      result = await request.query(query);
    } catch (e) {
      log.error('error attempting to update user password', {
        userId: this.id,
      });
    }
    if (result && result.rowsAffected && result.rowsAffected[0]) {
      log.info('successfully updated user password', { userId: this.id });
    } else {
      log.error('failed to update password', { userId: this.id });
    }
    return result;
  }

  async updateEmail(log = moduleLogger) {
    let pool = await pools.userReadAndWritePool;
    let request = new sql.Request(pool);

    let query = `UPDATE ${userTable} SET Email = @email WHERE UserID = @id`;

    request.input('email', sql.NVarChar, this.email);
    request.input('id', sql.Int, this.id);

    try {
      await request.query(query);
    } catch (e) {
      log.error('error attempting to update user email', {
        userId: this.id,
        error: e,
      });
    }
    log.info('successfully updated user email', {
      userId: this.id,
      email: this.email,
    });
    return;
  }

  getJWTPayload() {
    return {
      iss,
      sub: this.id,
    };
  }
};
