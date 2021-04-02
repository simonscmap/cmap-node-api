const base64url = require('base64-url');
const sql = require('mssql');

const awaitableEmailClient = require('../utility/emailAuth');
const emailTemplates = require('../utility/emailTemplates');
const { userReadAndWritePool } = require('../dbHandlers/dbPools');

exports.contactUs = async(req, res, next) => {
    let payload = req.body;

    let emailClient = await awaitableEmailClient;
    let content = emailTemplates.contactUs(payload);
    let message =
        "From: 'me'\r\n" +
        "To: simonscmap@uw.edu\r\n" +
        "Subject: Message from Simons CMAP User\r\n" +
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

exports.errorReport = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    let request = await new sql.Request(pool);
    let { errorText, browserInfo, osInfo } = req.body;

    request.input('errorText', sql.NVarChar, errorText);
    request.input('browserInfo', sql.NVarChar, browserInfo);
    request.input('osInfo', sql.NVarChar, osInfo);

    let query = `
        INSERT INTO [dbo].[tblFront_End_Errors] ([OS_Info], [Browser_Info], [Error])
        VALUES (@osInfo, @browserInfo, @errorText)
    `;

    try {
        await request.query(query);
    }

    catch(e){
        console.error(e);
    }
    return res.end();
}

// INSERT INTO Customers (CustomerName, ContactName, Address, City, PostalCode, Country)
// VALUES ('Cardinal', 'Tom B. Erichsen', 'Skagen 21', 'Stavanger', '4006', 'Norway');