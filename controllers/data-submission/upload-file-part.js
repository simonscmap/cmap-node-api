const { dropbox } = require("../../utility/Dropbox");
const initializeLogger = require("../../log-service");
const log = initializeLogger(
  "data-submission/begin-upload-session"
);
// Larger data submission must be uploaded in parts.  This endpoint takes a session ID from
// /beginuploadsession and uploads a chunk of the file
const uploadFilePart = async (req, res) => {
  const { id } = (req.user || {});
  const { sessionID } = req.body;

  const offset = parseInt(req.body.offset);

  let part = req.files[0].buffer;

  try {
    await dropbox.filesUploadSessionAppendV2({
      cursor: {
        session_id: sessionID,
        offset,
      },
      close: false,
      contents: part,
    });
    log.info ("Successfully uploaded file part", { sessionID, offset, userId: id });
    return res.sendStatus(200);

  } catch (e) {
    log.error("Failed to upload part", { error: e, sessionID, offset, userId: id });
    return res.sendStatus(500);
  }
};

module.exports = uploadFilePart;
