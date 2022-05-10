const { dropbox } = require("../../utility/Dropbox");
const sql = require("mssql");
const initializeLogger = require("../../log-service");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");

const log = initializeLogger(
  "controllers/data-submission/begin-upload-session"
);

// Begin data submission upload session and return ID
const beginUploadSession = async (req, res) => {
  const { datasetName } = req.body;
  let pool = await userReadAndWritePool;

  if (!req.user.isDataSubmissionAdmin) {
    try {
      let checkOwnerRequest = new sql.Request(pool);
      checkOwnerRequest.input("root", sql.VarChar, datasetName);

      let checkOwnerQuery = `
                SELECT Submitter_ID from tblData_Submissions
                WHERE Filename_Root = @root
            `;

      let checkOwnerResult = await checkOwnerRequest.query(checkOwnerQuery);
      if (checkOwnerResult.recordset && checkOwnerResult.recordset.length) {
        let owner = checkOwnerResult.recordset[0].Submitter_ID;

        if (req.user.id !== owner) {
          log.warn("mismatch between uploading user and dataset owner");
          res.status(401).send("wrongUser");
          return;
        }
      }
    } catch (e) {
      log.error("error checking dataset owner", e);
      res.sendStatus(500);
      return;
    }
  }

  try {
    let startResponse = await dropbox.filesUploadSessionStart({
      close: false,
    });
    return res.json({ sessionID: startResponse.session_id });
  } catch (e) {
    log.error("failed to start upload session", e);
    res.sendStatus(500);
    return;
  }
};

module.exports = beginUploadSession;
