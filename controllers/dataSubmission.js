const sql = require('mssql');

const { dropbox } = require('../utility/Dropbox');
const { userReadAndWritePool, dataReadOnlyPool } = require('../dbHandlers/dbPools');
const awaitableEmailClient = require('../utility/emailAuth');
const emailTemplates = require('../utility/emailTemplates');
const base64url = require('base64-url');

let emailSubjectRoot = 'CMAP Data Submission - ';

// Begin data submission upload session and return ID
exports.beginUploadSession = async(req, res, next) => {
    const { datasetName } = req.body;
    let pool = await userReadAndWritePool;

    if(!req.user.isDataSubmissionAdmin){
        try {
            let checkOwnerRequest = new sql.Request(pool);
            checkOwnerRequest.input('root', sql.VarChar, datasetName);
    
            let checkOwnerQuery = `
                SELECT Submitter_ID from tblData_Submissions
                WHERE Filename_Root = @root
            `
    
            let checkOwnerResult = await checkOwnerRequest.query(checkOwnerQuery);
            if(checkOwnerResult.recordset && checkOwnerResult.recordset.length){
                let owner = checkOwnerResult.recordset[0].Submitter_ID;
    
                if(req.user.id !== owner){
                    return res.status(401).send('wrongUser');
                }
            }
        }

        catch(e) {
            console.log(e);
            return res.sendStatus(500);
        }
    }

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

// Commit upload session (completing upload)
exports.commitUpload = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    
    const { sessionID, dataSource, datasetLongName } = req.body;
    let fileName = req.body.fileName.trim();
    const offset = parseInt(req.body.offset);
    const currentTime = Date.now();

    let submissionType;

    try {
        let finishedResponse = await dropbox.filesUploadSessionFinish({
            cursor: {
                session_id: sessionID,
                offset
            },
            commit: {
                path: `/${fileName}/${fileName}_${currentTime}.xlsx`,
                mode: "add",
                autorename: true,
                mute: false
            }
        })

        let checkFilenameRequest = new sql.Request(pool);
        let checkFilenameQuery = `
            SELECT ID, QC1_Completion_Date_Time FROM tblData_Submissions
            WHERE Filename_Root = '${fileName}'
        `;

        let checkFilenameResult = await checkFilenameRequest.query(checkFilenameQuery);

        var dataSubmissionID;
        var qc1WasCompleted;

        if(checkFilenameResult.recordset && checkFilenameResult.recordset.length){
            dataSubmissionID = checkFilenameResult.recordset[0].ID;
            qc1WasCompleted = !!checkFilenameResult.recordset[0].QC1_Completion_Date_Time;
            submissionType = 'Update';
        }

        const transaction = new sql.Transaction(pool);
        
        try {
            await transaction.begin();

            if(dataSubmissionID === undefined){
                submissionType = 'New';
                const dataSubmissionsInsert = new sql.Request(transaction);
                dataSubmissionsInsert.input('filename', sql.NVarChar, fileName);
                dataSubmissionsInsert.input('dataSource', sql.NVarChar, dataSource);
                dataSubmissionsInsert.input('datasetLongName', sql.NVarChar, datasetLongName);
                const dataSubmissionsInsertQuery = `
                INSERT INTO [dbo].[tblData_Submissions] 
                (Filename_Root, Submitter_ID, Data_Source, Dataset_Long_Name)
                VALUES (@filename, ${req.user.id}, @dataSource, @datasetLongName)
                SELECT SCOPE_IDENTITY() AS ID
                `;

                const dataSubmissionsInsertQueryResult = await dataSubmissionsInsert.query(dataSubmissionsInsertQuery);
                dataSubmissionID = dataSubmissionsInsertQueryResult.recordset[0].ID;
            }

            else {
                let dataSubmissionPhaseChange = new sql.Request(transaction);
                dataSubmissionPhaseChange.input('filename', sql.NVarChar, fileName);
                let dataSubmissionPhaseChangeQuery = `
                    UPDATE [dbo].[tblData_Submissions]
                    SET Phase_ID = ${qc1WasCompleted ? 7 : 2}
                    WHERE Filename_Root = @filename
                `;
                const dataSubmissionPhaseChangeQueryResult = await dataSubmissionPhaseChange.query(dataSubmissionPhaseChangeQuery);
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

    let emailClient = await awaitableEmailClient;

    let notifyAdminContent = emailTemplates.dataSubmissionAdminNotification(fileName, req.user, submissionType);

    let notifyAdminMessage =
        "From: 'me'\r\n" +
        "To: " + 'cmap-data-submission@uw.edu' + "\r\n" +
        `Subject: ${submissionType === 'New' ? emailSubjectRoot + fileName : 'Re: ' + emailSubjectRoot + fileName}\r\n` +
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

    let notifyUserContent = emailTemplates.dataSubmissionUserNotification(fileName);
    let notifyUserMessage =
        "From: 'me'\r\n" +
        "To: " + req.user.email + "\r\n" +
        `Subject: ${submissionType === 'New' ? emailSubjectRoot + fileName : 'Re: ' + emailSubjectRoot + fileName}\r\n` +
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

// Larger data submission must be uploaded in parts.  This endpoint takes a session ID from
// /beginuploadsession and uploads a chunk of the file
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

// Retrieve all data submissions. Used on admin dashboard
exports.submissions = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    let request = await new sql.Request(pool);
    // let includeCompleted = req.query.includeCompleted;    

    let query = `
        SELECT 
            [dbo].[tblData_Submissions].[Filename_Root] as Dataset, 
            [dbo].[tblData_Submissions].[Dataset_Long_Name], 
            [dbo].[tblData_Submissions].[Data_Source], 
            [dbo].[tblData_Submissions].[ID] as Submission_ID, 
            [dbo].[tblData_Submission_Phases].[Phase],
            [dbo].[tblData_Submissions].[Phase_ID],
            [dbo].[tblData_Submissions].[Start_Date_Time],
            [dbo].[tblData_Submissions].[Ingestion_Date_Time],
            CONCAT([dbo].[tblUsers].[FirstName], ' ', [dbo].[tblUsers].[FamilyName]) as Name
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblData_Submission_Phases] ON [tblData_Submissions].[Phase_ID] = [tblData_Submission_Phases].[ID]
        JOIN [dbo].[tblUsers] on [tblData_Submissions].[Submitter_ID] = [dbo].[tblUsers].UserID
        ORDER BY [dbo].[tblData_Submissions].[Phase_ID]
        `;
        // ${includeCompleted ? '' : " WHERE NOT [tblData_Submissions].[Phase_ID]=6"}

    let result = await request.query(query);
    return res.json(result.recordset);
}

// Add a timestamped comment to a submission
exports.addComment = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    let request = await new sql.Request(pool);

    let { submissionID, comment } = req.body;
    let ownerID;
    let qc1WasCompleted = false;

    //TODO make this check a re-usable function / middleware
    if(!req.user.isDataSubmissionAdmin){
        try {
            let checkOwnerRequest = new sql.Request(pool);
            checkOwnerRequest.input('ID', sql.Int, submissionID);
    
            let checkOwnerQuery = `
                SELECT Submitter_ID, QC1_Completion_Date_Time from tblData_Submissions
                WHERE ID = @ID
            `;
    
            let checkOwnerResult = await checkOwnerRequest.query(checkOwnerQuery);
            let owner = checkOwnerResult.recordset[0].Submitter_ID;
            qc1WasCompleted = !!checkOwnerResult.recordset[0].QC1_Completion_Date_Time;

            if(req.user.id !== owner){
                return res.sendStatus(401);
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

        SELECT [dbo].[tblData_Submissions].[Filename_Root],
        [dbo].[tblUsers].[Email]
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblUsers] on [dbo].[tblData_Submissions].[Submitter_ID] = UserID
        WHERE ID = @ID
    `;

    try {
        let result = await request.query(addCommentQuery);
        var datasetName = result.recordset[0].Filename_Root;
        var userEmail = result.recordset[0].Email;
        res.sendStatus(200);

        let emailClient = await awaitableEmailClient;

        var notificationContent;
        var notificationDestination;

        if(!req.user.isDataSubmissionAdmin){
            notificationContent = emailTemplates.dataSubmissionUserComment(datasetName, comment);
            notificationDestination = 'cmap-data-submission@uw.edu';

            let dataSubmissionPhaseChange = new sql.Request(pool);
            dataSubmissionPhaseChange.input('filename', sql.NVarChar, datasetName);
            
            let dataSubmissionPhaseChangeQuery = `
                UPDATE [dbo].[tblData_Submissions]
                SET Phase_ID = ${qc1WasCompleted ? 7 : 2}
                WHERE Filename_Root = @filename
            `;
            const dataSubmissionPhaseChangeQueryResult = await dataSubmissionPhaseChange.query(dataSubmissionPhaseChangeQuery);
        }
        
        else {
            notificationContent = emailTemplates.dataSubmissionAdminComment(datasetName, comment);
            notificationDestination = userEmail;
        }
        
        let notification =
        "From: 'me'\r\n" +
        "To: " + notificationDestination + "\r\n" +
        `Subject: Re: ${emailSubjectRoot + datasetName}\r\n` +
        "Content-Type: text/html; charset='UTF-8'\r\n" +
        "Content-Transfer-Encoding: base64\r\n\r\n" +
        notificationContent;

        let rawNotification = base64url.encode(notification);

        try {
            await emailClient.users.messages.send({
                userId: 'me',
                resource: {
                    raw: rawNotification
                }
            })
        } 

        catch(e) {
            console.log('Failed to enter new comment');
            console.log(e);
            return res.sendStatus(500);
        }
    }
    catch(e) {
        console.log('Failed to enter new comment');
        console.log(e);
        return res.sendStatus(500);
    }
}

// Retrieve submissions for a single user. Used by user dashboard
exports.submissionsByUser = async(req, res, next) => {
    let pool = await dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let userID = req.user.id;

    let query = `
        SELECT 
            [dbo].[tblData_Submissions].[Filename_Root] as Dataset, 
            [dbo].[tblData_Submissions].[ID] as Submission_ID, 
            [dbo].[tblData_Submission_Phases].[Phase],
            [dbo].[tblData_Submissions].[Ingestion_Date_Time],
            [dbo].[tblData_Submissions].[QC1_Completion_Date_Time],
            [dbo].[tblData_Submissions].[QC2_Completion_Date_Time],
            [dbo].[tblData_Submissions].[DOI_Accepted_Date_Time],
            [dbo].[tblData_Submissions].[Start_Date_Time]
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblData_Submission_Phases] ON [tblData_Submissions].[Phase_ID] = [tblData_Submission_Phases].[ID]
        WHERE Submitter_ID = ${userID}
    `

    let result = await request.query(query);
    return res.json(result.recordset);
}

// Retrieves references to all file version of a submission. Not currently used
exports.uploadHistory = async(req, res, next) => {
    let pool = await dataReadOnlyPool;
    let request = await new sql.Request(pool);

    let id = req.query.submissionID;
    request.input('ID', sql.Int, id);

    let query = `
        SELECT * FROM tblData_Submission_Files
        WHERE [Submission_ID] = @ID
    `;
}

// Retrieves comments for a single submission
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

// Changes the current phase of a submission. User by admin dashboard. Automatically sends relevant email to user
exports.setPhase = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    let request = await new sql.Request(pool);

    let { phaseID, submissionID } = req.body;

    request.input('phaseID', sql.Int, phaseID);
    request.input('submissionID', sql.Int, submissionID);

    let phaseSpecificQueryPart;

    switch(phaseID){
        case 4: phaseSpecificQueryPart = `, QC2_Completion_Date_Time = GETDATE(), QC2_Completed_By = ${req.user.id}`; break;
        case 5: phaseSpecificQueryPart = `, DOI_Accepted_Date_Time = GETDATE()`; break;
        case 6: phaseSpecificQueryPart = ', Ingestion_Date_Time = GETDATE()'; break;
        case 7: phaseSpecificQueryPart = `, QC1_Completion_Date_Time = GETDATE(), QC1_Completed_By = ${req.user.id}`; break;
        default: phaseSpecificQueryPart = ''; break;
    }

    let query = `
        UPDATE [tblData_Submissions]
        SET Phase_ID = @phaseID${phaseSpecificQueryPart}
        WHERE ID = @submissionID;

        SELECT [dbo].[tblData_Submissions].[Filename_Root],
        [dbo].[tblUsers].[Email]
        FROM [dbo].[tblData_Submissions]
        JOIN [dbo].[tblUsers] on [dbo].[tblData_Submissions].[Submitter_ID] = UserID
        WHERE ID = @submissionID
    `;

    try {
        let result = await request.query(query);
        res.sendStatus(200);

        let datasetName = result.recordset[0].Filename_Root;
        let email = result.recordset[0].Email;

        let emailClient = await awaitableEmailClient;
        let notificationContent;

        if(phaseID === 4 || phaseID === 6){
            if(phaseID === 4){
                notificationContent = emailTemplates.awaitingDOINotification(datasetName);
            }

            else if(phaseID === 6){
                notificationContent = emailTemplates.ingestionCompleteNotification(datasetName);
            }

            let notification =
            "From: 'me'\r\n" +
            "To: " + email + "\r\n" +
            `Subject: Re: ${emailSubjectRoot + datasetName}\r\n` +
            "Content-Type: text/html; charset='UTF-8'\r\n" +
            "Content-Transfer-Encoding: base64\r\n\r\n" +
            notificationContent;

            let rawNotification = base64url.encode(notification);

            try {
                await emailClient.users.messages.send({
                    userId: 'me',
                    resource: {
                        raw: rawNotification
                    }
                })
            } 
    
            catch(e) {
                console.log('Data submission notify admin failed:')
                console.log(e);
            }
        }

        if(phaseID === 7){
            notificationContent = emailTemplates.qc1CompleteNotification(datasetName, req.user);

            let notification =
            "From: 'me'\r\n" +
            "To: cmap-data-submission@uw.edu\r\n" +
            `Subject: ${datasetName} Ready for QC2\r\n` +
            "Content-Type: text/html; charset='UTF-8'\r\n" +
            "Content-Transfer-Encoding: base64\r\n\r\n" +
            notificationContent;

            let rawNotification = base64url.encode(notification);

            try {
                await emailClient.users.messages.send({
                    userId: 'me',
                    resource: {
                        raw: rawNotification
                    }
                });
            } 
    
            catch(e) {
                console.log('Data submission notify admin failed:')
            }
        }
    }

    catch(e) {
        console.log('Failed to update phase ID');
        console.log(e);
        return res.sendStatus(500);
    }
}

// Generates a temporary download link to the most recent version of a submission, and sends to client
exports.retrieveMostRecentFile = async(req, res, next) => {
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

    //TODO trim before entry so we don't need to do it everywhere else    
    const dataset = result.recordset[0].Filename_Root.trim();
    const timestamp = result.recordset[0].Timestamp.trim();
    let path = `/${dataset}/${dataset}_${timestamp}.xlsx`;

    try {
        let boxResponse = await dropbox.filesGetTemporaryLink({path});
        return res.json({link: boxResponse.link, dataset});
    }

    catch(e) {
        console.log('Failed to get temporary download link');
        console.log(e);
        return res.sendStatus(500);
    }

}

// Deletes a data submission. Used on admin dashboard
exports.deleteSubmission = async(req, res, next) => {
    let pool = await userReadAndWritePool;
    let request = await new sql.Request(pool);

    try {
        request.input('submissionID', sql.Int, req.query.submissionID)
        let query = `DELETE FROM tblData_Submissions WHERE ID = @submissionID`;
        let response = await request.query(query);
        res.sendStatus(200);
        return next();
    }

    catch(e) {
        console.log('Failed to delete dataset');
        console.log(e);
        res.sendStatus(500);
    }

}