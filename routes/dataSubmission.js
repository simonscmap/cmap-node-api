const router = require('express').Router();
const {
  addComment,
  beginUploadSession,
  checkName,
  commitUpload,
  deleteSubmission,
  listComments,
  listSubmissions,
  listSubmissionsByUser,
  mostRecentFile,
  setSubmissionPhase,
  uploadFilePart,
} = require('../controllers/data-submission');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');
const checkAdminAuth = require('../middleware/checkAdminAuth');
const passport = require('../middleware/passport');

// all endpoints defined on this router undergo auth upstream in the apiRouter

router.post(
  '/beginuploadsession',
  passport.authenticate(['headerapikey', 'jwt'], { session: false }),
  asyncControllerWrapper(beginUploadSession),
);
router.post(
  '/uploadfilepart',
  passport.authenticate(['headerapikey', 'jwt'], { session: false }),
  asyncControllerWrapper(uploadFilePart),
);

router.post(
  '/commitupload',
  passport.authenticate(['headerapikey', 'jwt'], { session: false }),
  asyncControllerWrapper(commitUpload),
);

router.post(
  '/checkname',
  passport.authenticate(['jwt'], { session: false }),
  asyncControllerWrapper(checkName),
);

router.post('/addcomment', asyncControllerWrapper(addComment));

router.get(
  '/submissions', // TODO merge /submissions and /submissionsbyuser
  checkAdminAuth,
  asyncControllerWrapper(listSubmissions),
);
router.get('/submissionsbyuser', asyncControllerWrapper(listSubmissionsByUser));

router.get(
  '/commenthistory', // TODO rename
  asyncControllerWrapper(listComments),
);

router.post(
  '/setphase', // TODO rename
  checkAdminAuth,
  asyncControllerWrapper(setSubmissionPhase),
);

router.get(
  '/retrievemostrecentfile', // TODO rename -> ?
  asyncControllerWrapper(mostRecentFile),
);

// TODO: why is this a GET?
router.get(
  '/deletesubmission',
  checkAdminAuth,
  asyncControllerWrapper(deleteSubmission),
);

module.exports = router;
