const router = require("express").Router();
const {
  addComment,
  beginUploadSession,
  commitUpload,
  deleteSubmission,
  listComments,
  listSubmissions,
  listSubmissionsByUser,
  mostRecentFile,
  setSubmissionPhase,
  uploadFilePart
}= require("../controllers/data-submission");

const asyncControllerWrapper = require("../errorHandling/asyncControllerWrapper");
const checkAdminAuth = require("../middleware/checkAdminAuth");

router.post(
  "/beginuploadsession",
  asyncControllerWrapper(beginUploadSession)
);
router.post(
  "/uploadfilepart",
  asyncControllerWrapper(uploadFilePart)
);
router.post(
  "/commitupload",
  asyncControllerWrapper(commitUpload)
);

router.post(
  "/addcomment",
  asyncControllerWrapper(addComment)
);

router.get(
  "/submissions", // TODO merge /submissions and /submissionsbyuser
  checkAdminAuth,
  asyncControllerWrapper(listSubmissions)
);
router.get(
  "/submissionsbyuser",
  asyncControllerWrapper(listSubmissionsByUser)
);

router.get(
  "/commenthistory", // TODO rename
  asyncControllerWrapper(listComments)
);

router.post(
  "/setphase", // TODO rename
  checkAdminAuth,
  asyncControllerWrapper(setSubmissionPhase)
);

router.get(
  "/retrievemostrecentfile", // TODO rename -> ?
  asyncControllerWrapper(mostRecentFile)
);

router.get(
  "/deletesubmission",
  checkAdminAuth,
  asyncControllerWrapper(deleteSubmission)
);

module.exports = router;
