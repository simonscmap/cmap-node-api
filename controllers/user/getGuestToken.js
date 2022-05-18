const jwt = require("jsonwebtoken");
const sql = require("mssql");

const pools = require("../../dbHandlers/dbPools");
const jwtConfig = require("../../config/jwtConfig");
const guestTokenHashFromRequest = require("../../utility/guestTokenHashFromRequest");
const sqlSegments = require("../../utility/sqlSegments");

const initializeLogger = require("../../log-service");
const log = initializeLogger("controllers/user/getGuestToken");

// Generates and sends a guest token to user
module.exports = async (req, res) => {
  // TODO unhandled failure case
  let pool = await pools.userReadAndWritePool;

  // TODO unhandled failure case
  let checkTokenLimitRequest = await new sql.Request(pool);

  // TODO unhandled failure case
  let checkTokenLimitResult = await checkTokenLimitRequest.query(`
        ${sqlSegments.declareAndSetDateTimeVariables}

        SELECT * FROM [tblGuest_Tokens_Issued_Hourly]
        WHERE [Date_Time] = ${sqlSegments.dateTimeFromParts}
    `);

  if (
    checkTokenLimitResult.recordset &&
    checkTokenLimitResult.recordset.length
  ) {
    let tokensIssuedThisHour = checkTokenLimitResult.recordset[0].Tokens_Issued;
    if (tokensIssuedThisHour > 200) {
      return res.sendStatus(503);
    }
  } else {
    // TODO unhandled failure case
    let addNewHourRowRequest = await new sql.Request(pool);

    try {
      await addNewHourRowRequest.query(`
                ${sqlSegments.declareAndSetDateTimeVariables}
                INSERT INTO [tblGuest_Tokens_Issued_Hourly] ([Date_Time], [Tokens_Issued])
                VALUES ( ${sqlSegments.dateTimeFromParts}, 1)
            `);
    } catch (e) {
      if (e.number === 2601) {
        // another node instance inserted this row during our network call.
        log.warning(
          "detected increment by other node while attempting to get new guest token",
          { error: e }
        );
        // Just increment
      } else {
        log.error("error getting guest token", { error: e });
        // TODO does an error here indicate 503 service unavailable
        return res.sendStatus(503);
      }
    }
  }

  // if you're not going to increment a row and send back a token
  // you should have exited the function by now

  let incrementTokensIssuedRequest = await new sql.Request(pool);

  // execute query
  // TODO does this need to be awaited?
  incrementTokensIssuedRequest.query(`
        ${sqlSegments.declareAndSetDateTimeVariables}
        UPDATE [tblGuest_Tokens_Issued_Hourly]
        SET [Tokens_Issued] = [Tokens_Issued] + 1
        WHERE [Date_Time] = ${sqlSegments.dateTimeFromParts}
    `);

  let hash = guestTokenHashFromRequest(req);

  let storeTokenInfoRequest = await new sql.Request(pool);

  // TODO await? error handling?
  let storeTokenInfoResult = await storeTokenInfoRequest.query(`
        INSERT INTO tblGuest_Tokens ([Hash])
        Values ('${hash}')
        SELECT SCOPE_IDENTITY() AS ID
    `);

  let token = {
    id: storeTokenInfoResult.recordset[0].ID,
    hash,
  };

  let expires = parseInt(req.query.expires);

  res.cookie(
    "guestToken",
    await jwt.sign(token, jwtConfig.secret, { expiresIn: "24h" }),
    { expires: new Date(expires) }
  );

  log.info("success getting guest token");
  return res.sendStatus(200);
};
