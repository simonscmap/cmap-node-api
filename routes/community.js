const router = require('express').Router();

const communityController = require('../controllers/community');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// Handle contact us form
router.post('/contactus', asyncControllerWrapper(communityController.contactUs));
router.post('/errorreport', asyncControllerWrapper(communityController.errorReport));

module.exports = router;