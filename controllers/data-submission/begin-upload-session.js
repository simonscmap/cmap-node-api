const { dropbox } = require("../../utility/Dropbox");
const sql = require("mssql");
const initializeLogger = require("../../log-service");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");
const { safePath } = require("../../utility/objectUtils.js");

const log = initializeLogger(
  "controllers/data-submission/begin-upload-session"
);

// Begin dropbox file-upload session and return that session ID to client
// for use in file-part uploads and commit
const beginUploadSession = async (req, res) => {
  if (!req.user) {
    res.status(401).send ('You must be logged in to upload a data submission');
  }
  // if new, we just need dataset name
  // if update, we need id
  const { submissionType, submissionId } = req.body;

  log.debug ("begin upload session", { submissionType, submissionId });

  // Basic arg check
  if (submissionType !== 'new' && submissionType !== 'update') {
    res.status(400).send ("invalid args: submissionType must be 'new' or 'update'");
    return;
  }

  if (submissionType === 'update' && !submissionId) {
    res.status(400).send ("invalid args: submissionId must be set if submisisonType is 'update'");
    return;
  }

  let pool = await userReadAndWritePool;

  // if the user is not an admin, make sure that they are the owner of the file
  // (this assumes it is not a new submission)
  if (submissionType === 'update' && !req.user.isDataSubmissionAdmin) {
    try {
      let checkOwnerRequest = new sql.Request(pool);
      checkOwnerRequest.input("id", sql.VarChar, submissionId);

      let checkOwnerQuery = `
                SELECT Submitter_ID from tblData_Submissions
                WHERE ID = @id
            `;

      let checkOwnerResult = await checkOwnerRequest.query(checkOwnerQuery);

      if (checkOwnerResult.recordset && checkOwnerResult.recordset.length) {
        let owner = checkOwnerResult.recordset[0].Submitter_ID;

        if (req.user.id !== owner) {
          log.warn("mismatch between uploading user and dataset owner");
          res.status(401).send("wrongUser");
          return;
        }
      } else {
        // is this the case where it is a new submission, and no match is returned?
        // if so, we should check this against a submissionType arg
        if (submissionType !== "new") {
          // we expect a record, since the submission type is update, and a submission id is provided
          log.warn("no record of submission", { submissionType, submissionId });
          res.status(404).send("noRecord");
          return;
        }
      }
    } catch (e) {
      log.error("error checking dataset owner", e);
      res.status(500).send ('error checking dataset owner');
      return;
    }
  }


  const num_sessions = submissionType === 'new' ? 2 : 1;

  try {
    // let startResponse = await dropbox.filesUploadSessionStart({
    //   close: false,
    // });


    // option session_type: sequential | concurrent | other
    let response = await dropbox.filesUploadSessionStartBatch({ num_sessions });
    let sessionIds = safePath (['result', 'session_ids']) (response);

    if (Array.isArray (sessionIds)) {
      return res.json({ sessionIds });
    } else {
      log.error ("failed to get session ids from dropbox", { response });
      throw new Error ("Unexpected result from dropbox");
    }
  } catch (e) {
    log.error("failed to start upload session", e);
    res.sendStatus(500);
    return;
  }
};

module.exports = beginUploadSession;
