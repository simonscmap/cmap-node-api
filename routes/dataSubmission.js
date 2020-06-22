const router = require('express').Router();
const dataSubmissionController = require('../controllers/dataSubmission');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');
const checkAdminAuth = require('../middleware/checkAdminAuth');

router.get('/beginuploadsession', asyncControllerWrapper(dataSubmissionController.beginUploadSession)); // TODO review auth
router.post('/uploadfilepart', asyncControllerWrapper(dataSubmissionController.uploadFilePart));
router.post('/commitupload', asyncControllerWrapper(dataSubmissionController.commitUpload));

router.post('/addcomment', asyncControllerWrapper(dataSubmissionController.addComment));

router.get('/submissions', checkAdminAuth, asyncControllerWrapper(dataSubmissionController.submissions));
router.get('/submissionsbyuser', asyncControllerWrapper(dataSubmissionController.submissionsByUser));

router.get('/uploadhistory', checkAdminAuth, asyncControllerWrapper(dataSubmissionController.uploadHistory));

router.get('/commenthistory', asyncControllerWrapper(dataSubmissionController.commentHistory));

router.post('/setphase', checkAdminAuth, asyncControllerWrapper(dataSubmissionController.setPhase));

router.get('/retrievemostrecentfile', asyncControllerWrapper(dataSubmissionController.retrieveMostRecentFile));

module.exports = router;