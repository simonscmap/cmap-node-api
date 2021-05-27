const bcrypt = require('bcryptjs');
const sql = require('mssql');

const userTable = 'tblUsers'
const apiKeyTable = 'tblApi_Keys'

const iss = "Simons CMAP";

var pools = require('../dbHandlers/dbPools');

// This is the general user class. Instances can include a password in some routes, hence "unsafe". Makesafe
// returns an object literal with partial information and no password.
module.exports = class UnsafeUser {

    constructor(userInfo){
        this.firstName = userInfo.firstName || userInfo.FirstName || 'Guest';
        this.lastName = userInfo.lastName || userInfo.FamilyName || 'Guest';
        this.username = userInfo.userName || userInfo.Username || userInfo.username || 'Guest';
        this.password = userInfo.password || userInfo.Password || 'NoPass';
        this.email = userInfo.email || userInfo.Email || 'Guest';
        this.institute = userInfo.institute || userInfo.Institute || null;
        this.department = userInfo.department || userInfo.Department || null;
        this.country = userInfo.country || userInfo.Country || null;

        this.googleID = userInfo.googleID || userInfo.GoogleID || null;

        this.id = userInfo.UserID || userInfo.id || null;

        this.apiKey = userInfo.Api_Key || null;
        this.apiKeyID = userInfo.Api_Key_ID || userInfo.apiKeyID || null;
        this.isDataSubmissionAdmin = Boolean(userInfo.Is_Data_Submission_Admin) || Boolean(userInfo.isDataSubmissionAdmin) || false;
    }

    static async getUserByUsername(username){
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);
        request.input('username', sql.NVarChar, username);
        request.on('error', err => console.log(err));

        try {
            let result = await request.query(`SELECT TOP 1 * FROM ${userTable} WHERE username = @username`);
        }

        catch(e) {console.log(e)}

        return result.recordset.length ? new this(result.recordset[0]) : false;
    }

    static async getUserByID(id){
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);
        request.input('id', sql.Int, id);
        request.on('error', err => console.log(err));
        let result = await request.query(`SELECT TOP 1 * FROM ${userTable} WHERE UserId = @id`);
        return result.recordset.length ?  new this(result.recordset[0]) : false;
    }

    static async getUserByEmail(email){
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);
        request.input('email', sql.NVarChar, email);
        request.on('error', err => console.log(err));
        let result = await request.query(`SELECT TOP 1 * FROM ${userTable} WHERE email = @email`);
        return result.recordset.length ? new this(result.recordset[0]) : false;
    }

    static async getUserByApiKey(key){
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);
        request.input('key', sql.NVarChar, key);
        request.on('error', err => console.log(err));
        let result = await request.query(`SELECT TOP 1 *,${apiKeyTable}.ID as Api_Key_ID FROM ${userTable} JOIN ${apiKeyTable} on ${apiKeyTable}.User_ID = ${userTable}.UserID WHERE Api_Key = @key`);
        
        //Throw not found error if no results
        if(!result.recordset.length) throw new Error('API Key not found');
        return new this(result.recordset[0]);
    }

    static async getUserByGoogleID(id){
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);
        request.input('id', sql.VarChar, id);
        request.on('error', err => console.log(err));
        let result = await request.query(`SELECT * FROM ${userTable} WHERE GoogleID = @id`);
        
        if(!result.recordset.length) return false;
        
        return new this(result.recordset[0]);
    }

    static async getApiKeysByUserID(id){
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);
        request.input('user_id', sql.Int, id);
        request.on('error', err => console.log(err));
        let result = await request.query(`SELECT Api_Key, Description from ${apiKeyTable} WHERE User_ID = @user_id`);
        return result.recordset.length ? result.recordset : null;
    }

    makeSafe(){ // Returns user object that can be sent to client
        let safeUser = {
            firstName: this.firstName,
            lastName: this.lastName,
            email: this.email,
            department: this.department,
            institute: this.institute,
            country: this.country,
            id: this.id,
            username: this.username,
            isDataSubmissionAdmin: this.isDataSubmissionAdmin
        }

        return safeUser;
    }

    async validateUsernameAndEmail(){
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);
        request.input('username', sql.NVarChar, this.username);
        request.input('email', sql.NVarChar, this.email);

        let query = `SELECT * FROM ${userTable} WHERE Username = @username OR Email = @email`;

        let result = await request.query(query);
        if(result.recordset.length) return false;
        return true;
    }

    async saveAsNew(){ 
        // Validates and saves user to db. 

        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);
        let hashedPassword = this.password === 'NoPass' ? 'NoPass' : await bcrypt.hash(this.password, 10);
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

        return await request.query(query);
    }

    // Use to associate a google ID with an existing account for first time google sign-on
    async attachGoogleIDToExistingUser(){
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);

        let query = `UPDATE ${userTable} SET GoogleID = @googleid WHERE UserID = @id`;

        request.input('googleid', sql.VarChar, this.googleID);
        request.input('id', sql.VarChar, this.id);

        return await request.query(query);
    }

    // Update method for less-sensitive information shown on the front end user profile
    async updateUserProfile(){
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);

        let query = `UPDATE ${userTable} SET FirstName = @firstname, FamilyName = @familyname, Institute = @institute, Department = @department, Country = @country WHERE UserID = @id`;

        request.input('firstname', sql.NVarChar, this.firstName);
        request.input('familyname', sql.NVarChar, this.lastName);
        request.input('institute', sql.NVarChar, this.institute);
        request.input('department', sql.NVarChar, this.department);
        request.input('country', sql.NVarChar, this.country);
        request.input('id', sql.VarChar, this.id);

        return await request.query(query);
    }

    // Password update
    async updatePassword(){
        // Updates password based on email
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);

        let hashedPassword = await bcrypt.hash(this.password, 10);

        let query = `UPDATE ${userTable} SET Password = @password WHERE UserID = @id`;

        request.input('password', sql.NVarChar, hashedPassword);
        request.input('id', sql.Int, this.id);

        return await request.query(query);
    }

    async updateEmail(){
        // Updates password based on email
        let pool = await pools.userReadAndWritePool;
        let request = await new sql.Request(pool);

        let query = `UPDATE ${userTable} SET Email = @email WHERE UserID = @id`;

        request.input('email', sql.NVarChar, this.email);
        request.input('id', sql.Int, this.id);

        return await request.query(query);
    }

    getJWTPayload(){
        return {
            iss,
            sub: this.id
        };
    }
}