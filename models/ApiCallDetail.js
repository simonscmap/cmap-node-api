const sql = require("mssql");
const createNewLogger = require('../log-service');
const mapPathToRouteId = require("../config/routeMapping");
// const userDBConfig = require("../config/dbConfig").userTableConfig;
var pools = require("../dbHandlers/dbPools");
const apiCallsTable = "tblApi_Calls";
// const apiCallDetailsTable = "tblApi_Call_Details";

const log = createNewLogger().setModule('ApiCallDetail');

// Model for tblApi_Calls
module.exports = class ApiCallDetail {
  constructor(req) {
    this.ip = req.headers["x-forwarded-for"]
      ? req.headers["x-forwarded-for"].split(",")[0]
      : req.ip || "None";
    this.requestId = req.requestId;
    this.clientHostName = req.headers.host;
    this.routeID = mapPathToRouteId(req.path);
    this.startTime = new Date();
    this.clientBrowser = req.useragent.browser || null;
    this.clientOS = req.useragent.os || null;
    this.ignore = false;
    // baseUrl is the origin; path are the joined url segments after the origin
    this.requestPath = `${req.baseUrl || ""}${req.path}`;
    // for reasons I don't understand, this.requestPath does not
    // get recorded properly unless this next log.debug line is present
    // log.debug('api call detail constructor', this);
    this.saved = false;
    this.queryString = req.query;
  }

  checkIp() {
    if (!this.ip.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
      this.ignore = true;
    }
  }

  // Save the usage details to SQL
  async save(res, opt) {
    if (this.saved) {
      return;
    }
    this.saved = true; // prevent double logging

    let requestDuration = new Date() - this.startTime;

    let statusCode;
    if (res) {
      statusCode = res.statusCode;
    }

    log.info("api call detail", {
      ip: this.ip,
      clientHostName: this.clientHostName,
      clientOS: this.clientOS,
      userId: this.userID || 1,
      routeId: this.routeID,
      authMethod: this.authMethod || 0,
      queryString: this.queryString,
      apiKeyId: this.apiKeyID || null,
      requestDuration,
      urlPath: this.requestPath,
      requestId: this.requestId,
      responseStatus: statusCode,
      caller: opt && opt.caller || undefined
    });

    if (this.ignore) {
      return;
    }

    if (this.clientBrowser === "ELB-HealthChecker") {
      return;
    }

    let pool = await pools.userReadAndWritePool;
    let request = await new sql.Request(pool);

    request.input("Ip_Address", sql.VarChar, this.ip);
    request.input("Client_Host_Name", sql.VarChar, this.clientHostName || null);
    request.input("Client_OS", sql.VarChar, this.clientOS || null);
    request.input("Client_Browser", sql.VarChar, this.clientBrowser || null);
    request.input("User_ID", sql.Int, this.userID || 1);
    request.input("Route_ID", sql.Int, this.routeID);
    request.input("Auth_Method", sql.Int, this.authMethod || 0);
    request.input("Query", sql.VarChar, this.query || null);
    request.input("Api_Key_ID", sql.Int, this.apiKeyID || null);
    request.input("Request_Duration", sql.Int, requestDuration);
    request.input("URL_Path", sql.VarChar, this.requestPath);

    request.on("error", (e) => log.error("error", { error: e }));

    var query = `INSERT INTO ${apiCallsTable} (
            Ip_Address,
            Client_Host_Name,
            Client_OS,
            Client_Browser,
            User_ID,
            Route_ID,
            Query,
            URL_Path,
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
                @URL_Path,
                @Api_Key_ID,
                @Auth_Method,
                @Request_Duration
            )`;

    try {
      await request.query(query);
    } catch (e) {
      log.error('error while making insert into api calls table', e);
    }
  }
};
