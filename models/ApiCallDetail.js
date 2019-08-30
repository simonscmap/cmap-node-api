const sql = require('mssql');

const mapPathToRouteId = require('../config/routeMapping');
const userDBConfig = require('../config/dbConfig').userTableConfig;

const apiCallsTable = "tblApi_Calls";
const apiCallDetailsTable = "tblApi_Call_Details";

module.exports = class ApiCallRecord{
    constructor(req){
        // let xf = req.headers['x-forwarded-for'];
        this.ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : req.ip || 'None';
        this.clientHostName = req.headers.host;
        this.routeID = mapPathToRouteId(req.path);
        this.startTime = new Date();
        this.clientBrowser = req.useragent.browser || null;
        this.clientOS = req.useragent.os || null;
        this.ignore = false;
    }

    checkIp(){
        if(!this.ip.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)){
            this.ignore = true;
        }
    }

    // Save the usage details to SQL
    async save(){

        if(this.ignore) return;

        let pool = await new sql.ConnectionPool(userDBConfig).connect();
        let request = await new sql.Request(pool);

        request.input('Ip_Address',sql.VarChar, this.ip);
        request.input('Client_Host_Name', sql.VarChar, this.clientHostName || null);
        request.input("Client_OS", sql.VarChar, this.clientOS || null);
        request.input("Client_Browser", sql.VarChar, this.clientBrowser || null);
        request.input('User_ID', sql.Int, this.userID || 1);
        request.input('Route_ID', sql.Int, this.routeID);
        request.input('Auth_Method', sql.Int, this.authMethod || 0);
        request.input('Query', sql.VarChar, this.query || null);
        request.input('Api_Key_ID', sql.Int, this.apiKeyID || null);
        request.input('Request_Duration', sql.Int, new Date() - this.startTime);

        request.on('error', (err) => console.log(err));

        var query = `INSERT INTO ${apiCallsTable} (
            Ip_Address, 
            Client_Host_Name,
            Client_OS,
            Client_Browser,
            User_ID, 
            Route_ID, 
            Query,
            Api_Key_ID, 
            Auth_Method,
            Request_Duration) 
            VALUES (
                @Ip_Address,
                @Client_Host_Name,
                @Client_OS,
                @Client_Browser,
                @User_ID,
                @Route_ID,
                @Query,
                @Api_Key_ID,
                @Auth_Method,
                @Request_Duration
            )
            `
        
        try {
            await request.query(query);
        } catch (e) {return console.log(e)}

    }
}