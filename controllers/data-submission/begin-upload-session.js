const { dropbox } = require("../../utility/Dropbox");
const sql = require("mssql");
const initializeLogger = require("../../log-service");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");

const log = initializeLogger(
  "controllers/data-submission/begin-upload-session"
);

// Begin dropbox file-upload session and return that session ID to client
// for use in file-part uploads and commit
const beginUploadSession = async (req, res) => {
  // if new, we just need dataset name
  // if update, we need id
  const { submissionType, submissionId } = req.body;
  log.debug ("begin upload session", { submissionType, submissionId });
  let pool = await userReadAndWritePool;

  // if the user is not an admin, make sure that they are the owner of the file
  // (this assumes it is not a new submission)
  if (!req.user.isDataSubmissionAdmin) {
    try {
      let checkOwnerRequest = new sql.Request(pool);
      checkOwnerRequest.input("id", sql.VarChar, submissionId);

      let checkOwnerQuery = `
                SELECT Submitter_ID from tblData_Submissions
                WHERE Submission_ID = @id
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
      res.sendStatus(500);
      return;
    }
  }


  const num_sessions = submissionType === 'new' ? 2 : 1;

  try {
    // let startResponse = await dropbox.filesUploadSessionStart({
    //   close: false,
    // });


    // option session_type: sequential | concurrent | other
    let startResponse = await dropbox.filesUploadSessionStartBatch({ num_sessions })
    return res.json({ sessionIds: startResponse.session_ids });
  } catch (e) {
    log.error("failed to start upload session", e);
    res.sendStatus(500);
    return;
  }
};

module.exports = beginUploadSession;
