const { dropbox } = require("../../utility/Dropbox");
const sql = require("mssql");

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
          return res.status(401).send("wrongUser");
        }
      }
    } catch (e) {
      console.log(e);
      return res.sendStatus(500);
    }
  }

  try {
    let startResponse = await dropbox.filesUploadSessionStart({
      close: false,
    });
    return res.json({ sessionID: startResponse.session_id });
  } catch (e) {
    console.log("failed to start upload session");
    console.log(e);
    return res.sendStatus(500);
  }
};

module.exports = beginUploadSession;
