const sql = require('mssql');

const { dropbox } = require('../utility/Dropbox');
const { userReadAndWritePool, dataReadOnlyPool } = require('../dbHandlers/dbPools');
const awaitableEmailClient = require('../utility/emailAuth');
const emailTemplates = require('../utility/emailTemplates');
const base64url = require('base64-url');

// Begin upload session and return ID
exports.beginUploadSession = async(req, res, next) => {
    try {
        let startResponse = await dropbox.filesUploadSessionStart({
            close: false
        })
        return res.json({sessionID: startResponse.session_id});
    }

    catch(e) {
        console.log('failed to start upload session');
        console.log(e);
        return res.sendStatus(500);
    }
}

// Commit upload session
exports.commitUpload = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    
    const { sessionID, fileName } = req.body;
    const offset = parseInt(req.body.offset);
    const currentTime = Date.now();

    try {
        let finishedResponse = await dropbox.filesUploadSessionFinish({
            cursor: {
                session_id: sessionID,
                offset
            },
            commit: {
                path: `/${fileName}_${currentTime}`,
                mode: "add",
                autorename: true,
                mute: false
            }
        })

        let checkFilenameRequest = new sql.Request(pool);
        let checkFilenameQuery = `
            SELECT ID FROM tblData_Submissions
            WHERE Filename_Root = '${fileName}'
        `

        let checkFilenameResult = await checkFilenameRequest.query(checkFilenameQuery);

        var dataSubmissionID;
        if(checkFilenameResult.recordset && checkFilenameResult.recordset.length){
            dataSubmissionID = checkFilenameResult.recordset[0].ID;
        }

        const transaction = new sql.Transaction(pool);
        
        try {
            await transaction.begin();

            if(dataSubmissionID === undefined){
                const dataSubmissionsInsert = new sql.Request(transaction);
                dataSubmissionsInsert.input('filename', sql.NVarChar, fileName);
                const dataSubmissionsInsertQuery = `
                INSERT INTO [dbo].[tblData_Submissions] 
                (Filename_Root, Submitter_ID)
                VALUES (@filename, 1)
                SELECT SCOPE_IDENTITY() AS ID
                `;

                const dataSubmissionsInsertQueryResult = await dataSubmissionsInsert.query(dataSubmissionsInsertQuery);
                dataSubmissionID = dataSubmissionsInsertQueryResult.recordset[0].ID;
            }

            dataSubmissionFilesInsert = new sql.Request(transaction);
            let dataSubmissionFilesInsertQuery = `
                INSERT INTO [dbo].[tblData_Submission_Files]
                (Submission_ID, Timestamp)
                VALUES (${dataSubmissionID}, ${currentTime})
            `;
            await dataSubmissionFilesInsert.query(dataSubmissionFilesInsertQuery);

            await transaction.commit();
        }

        catch(e) {
            console.log('Transaction failed');
            console.log(e);
            try {
                await transaction.rollback();
            }

            catch(err) {
                //TODO send email notification
                console.log('Rollback failed');
                console.log(err);
            }
            return res.sendStatus(500);
        }

    }

    catch(e) {
        console.log('Failed to commit dropbox upload');
        console.log(e);
        return res.sendStatus(500);
    }

    res.sendStatus(200);

    // Send confirmation email to user and notification email to admin email
    let emailClient = await awaitableEmailClient;

    let notifyAdminContent = emailTemplates.dataSubmissionAdminNotification(fileName);

    let notifyAdminMessage =
        "From: 'me'\r\n" +
        "To: " + 'cmap-data-submission@uw.edu' + "\r\n" +
        "Subject: New Web App Data Submission\r\n" +
        "Content-Type: text/html; charset='UTF-8'\r\n" +
        "Content-Transfer-Encoding: base64\r\n\r\n" +
        notifyAdminContent;

    let rawAdminMessage = base64url.encode(notifyAdminMessage);

    try {
        await emailClient.users.messages.send({
            userId: 'me',
            resource: {
                raw: rawAdminMessage
            }
        })
    } 

    catch(e) {
        console.log('Data submission notify admin failed:')
        console.log(e);
    }

    let notifyUserContent = emailTemplates.dataSubmissionUserNotification();
    let notifyUserMessage =
        "From: 'me'\r\n" +
        // "To: " + req.user.email + "\r\n" +
        "To: " + 'denholtz@uw.edu' + "\r\n" +
        "Subject: Your CMAP Data Submission\r\n" +
        "Content-Type: text/html; charset='UTF-8'\r\n" +
        "Content-Transfer-Encoding: base64\r\n\r\n" +
        notifyUserContent;

    let rawUserMessage = base64url.encode(notifyUserMessage);

    try {
        await emailClient.users.messages.send({
            userId: 'me',
            resource: {
                raw: rawUserMessage
            }
        })
    } 

    catch(e) {
        console.log('Data submission notify user failed:')
        console.log(e);
    }
}

exports.uploadFilePart = async(req, res, next) => {
    const { sessionID } = req.body;
    const offset = parseInt(req.body.offset);

    let part = req.files[0].buffer;

    try {
        var uploadPartResponse = await dropbox.filesUploadSessionAppendV2({
            cursor: {
                session_id: sessionID,
                offset
            },
            close: false,
            contents: part
        });

        return res.sendStatus(200);
    }

    catch(e) {
        console.log('Failed to upload part');
        return res.sendStatus(500);
    }
}

exports.submissions = async(req, res, next) => {
    // TODO Phase ID may need to be updated
    let pool = await dataReadOnlyPool;
    let request = await new sql.Request(pool);
    // let includeCompleted = req.query.includeCompleted;    

    let query = `
        SELECT 
            [dbo].[tblData_Submissions].[Filename_Root] as Dataset, 
            [dbo].[tblData_Submissions].[ID] as Submission_ID, 
            [dbo].[tblData_Submission_Phases].[Phase],
            [dbo].[tblData_Submissions].[Phase_ID]
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblData_Submission_Phases] ON [tblData_Submissions].[Phase_ID] = [tblData_Submission_Phases].[ID]
        ORDER BY [dbo].[tblData_Submissions].[Phase_ID]
        `;
        // ${includeCompleted ? '' : " WHERE NOT [tblData_Submissions].[Phase_ID]=6"}

    let result = await request.query(query);
    return res.json(result.recordset);
}

exports.addComment = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    let request = await new sql.Request(pool);

    let { submissionID, comment } = req.body;
    //TO-DO send notification to either admin or user
    //commenter id from req.user

    if(!req.user.isDataSubmissionAdmin){
        try {
            let checkOwnerRequest = new sql.Request(pool);
            checkOwnerRequest.input('ID', sql.Int, submissionID);
    
            let checkOwnerQuery = `
                SELECT Submitter_ID from tblData_Submissions
                WHERE ID = @ID
            `
    
            let checkOwnerResult = await checkOwnerRequest.query(checkOwnerQuery);
            let owner = checkOwnerResult.recordset[0].Submitter_ID;

            if(req.user.id !== owner){
                return res.sendStatus(401);
                //TODO review 401 behavior in React
            }
        }

        catch(e) {
            console.log(e);
            return res.sendStatus(500);
        }
    }

    request.input('ID', sql.Int, submissionID);
    request.input('comment', sql.VarChar, comment);

    let addCommentQuery = `
        INSERT INTO [dbo].[tblData_Submission_Comments]
        (Data_Submission_ID, Commenter_ID, Comment)
        VALUES (@ID, ${req.user.id}, @comment)
    `;

    try {
        let result = await request.query(addCommentQuery);
        res.sendStatus(200);
    }

    catch(e) {
        console.log('Failed to enter new comment');
        console.log(e);
        return res.sendStatus(500);
    }

    // If comment not left by submitter send email to submitter

}

exports.submissionsByUser = async(req, res, next) => {
    let pool = await dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let userID = req.user.id;

    let query = `
        SELECT 
            [dbo].[tblData_Submissions].[Filename_Root] as Dataset, 
            [dbo].[tblData_Submissions].[ID] as Submission_ID, 
            [dbo].[tblData_Submission_Phases].[Phase]
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblData_Submission_Phases] ON [tblData_Submissions].[Phase_ID] = [tblData_Submission_Phases].[ID]
        WHERE Submitter_ID = ${userID}
    `

    let result = await request.query(query);
    return res.json(result.recordset);
}

exports.uploadHistory = async(req, res, next) => {
    // TODO returns full list of files associated with a submission
    let pool = await dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let id = req.query.submissionID;
    request.input('ID', sql.Int, id);

    let query = `
        SELECT * FROM tblData_Submission_Files
        WHERE [Submission_ID] = @ID
    `;
}

exports.commentHistory = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    let request = await new sql.Request(pool);

    let id = req.query.submissionID;

    if(!req.user.isDataSubmissionAdmin){
        try {
            let checkOwnerRequest = new sql.Request(pool);
            checkOwnerRequest.input('ID', sql.Int, id);
    
            let checkOwnerQuery = `
                SELECT Submitter_ID from tblData_Submissions
                WHERE ID = @ID
            `
    
            let checkOwnerResult = await checkOwnerRequest.query(checkOwnerQuery);
            let owner = checkOwnerResult.recordset[0].Submitter_ID;

            if(req.user.id !== owner){
                return res.sendStatus(401);
                //TODO review 401 behavior in React
            }
        }

        catch(e) {
            console.log(e);
            return res.sendStatus(500);
        }
    }
    
    request.input('ID', sql.Int, id);

    let query = `
        SELECT 
            [tblData_Submission_Comments].[Data_Submission_ID],
            [tblData_Submission_Comments].Comment,
            [tblData_Submission_Comments].Comment_Date_Time,
            [tblUsers].[FirstName] as Commenter
        FROM tblData_Submission_Comments
        JOIN [tblUsers] ON [tblData_Submission_Comments].[Commenter_ID] = [tblUsers].[UserID]
        WHERE [tblData_Submission_Comments].[Data_Submission_ID] = @ID
    `;

    try {
        let response = await request.query(query);
        return res.json(response.recordset);
    }

    catch(e){
        console.log(e);
        return res.sendStatus(500);
    }
}

exports.setPhase = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    let request = await new sql.Request(pool);

    let { phaseID, submissionID } = req.body;

    request.input('phaseID', sql.Int, phaseID);
    request.input('submissionID', sql.Int, submissionID);

    let query = `
        UPDATE [tblData_Submissions]
        SET Phase_ID = @phaseID
        WHERE ID = @submissionID;
    `;

    try {
        let result = await request.query(query);
        res.sendStatus(200);
    }

    catch(e) {
        console.log('Failed tp update phase ID');
        console.log(e);
        return res.sendStatus(500);
    }
}

exports.viewLatestUpload = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    let request = await new sql.Request(pool);

    let id = req.query.submissionID;
    request.input('ID', sql.Int, id);

    let query = `
        SELECT TOP 1
            [tblData_Submissions].[Filename_Root],
            [tblData_Submission_Files].[Timestamp]
        FROM [tblData_Submissions]
        JOIN [tblData_Submission_Files] ON [tblData_Submission_Files].[Submission_ID] = [tblData_Submissions].[ID]
        WHERE [tblData_Submissions].[ID] = @ID
        ORDER BY [tblData_Submission_Files].[Timestamp] DESC
    `;

    let result = await request.query(query);

    let record = result.recordset[0];
    let appendString = record.Filename_Root.trim() + '_' + record.Timestamp.trim();
    res.redirect('https://www.dropbox.com/home/Simons%20CMAP/Apps/Simons%20CMAP%20Web%20Data%20Submission?preview=' + appendString);
}