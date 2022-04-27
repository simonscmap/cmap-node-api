const { dropbox } = require("../../utility/Dropbox");

// Larger data submission must be uploaded in parts.  This endpoint takes a session ID from
// /beginuploadsession and uploads a chunk of the file
const uploadFilePart = async (req, res) => {
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

    return res.sendStatus(200);
  } catch (e) {
    console.log("Failed to upload part");
    return res.sendStatus(500);
  }
};

module.exports = uploadFilePart;
