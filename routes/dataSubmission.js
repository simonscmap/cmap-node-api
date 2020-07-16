const router = require('express').Router();
const dataSubmissionController = require('../controllers/dataSubmission');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');
const checkAdminAuth = require('../middleware/checkAdminAuth');

router.post('/beginuploadsession', asyncControllerWrapper(dataSubmissionController.beginUploadSession));
router.post('/uploadfilepart', asyncControllerWrapper(dataSubmissionController.uploadFilePart));
router.post('/commitupload', asyncControllerWrapper(dataSubmissionController.commitUpload));

router.post('/addcomment', asyncControllerWrapper(dataSubmissionController.addComment));

router.get('/submissions', checkAdminAuth, asyncControllerWrapper(dataSubmissionController.submissions));
router.get('/submissionsbyuser', asyncControllerWrapper(dataSubmissionController.submissionsByUser));

router.get('/uploadhistory', checkAdminAuth, asyncControllerWrapper(dataSubmissionController.uploadHistory));

router.get('/commenthistory', asyncControllerWrapper(dataSubmissionController.commentHistory));

router.post('/setphase', checkAdminAuth, asyncControllerWrapper(dataSubmissionController.setPhase));

router.get('/retrievemostrecentfile', asyncControllerWrapper(dataSubmissionController.retrieveMostRecentFile));

router.post('/newoption', asyncControllerWrapper(dataSubmissionController.newOption));
router.get('/newoptionsrequests', checkAdminAuth, asyncControllerWrapper(dataSubmissionController.newOptionRequests));
router.post('/approvenewoption', checkAdminAuth, asyncControllerWrapper(dataSubmissionController.approveNewOptions));
router.post('/rejectnewoption', checkAdminAuth, asyncControllerWrapper(dataSubmissionController.rejectNewOption));

module.exports = router;