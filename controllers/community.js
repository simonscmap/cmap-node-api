const sql = require('mssql');
const { userReadAndWritePool } = require('../dbHandlers/dbPools');

// Front end error boundary sends error reports to this endpoints when the app crashes
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
