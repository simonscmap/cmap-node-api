const router = require('express').Router();

const communityController = require('../controllers/community');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// Handle contact us form
router.get('/contactus', asyncControllerWrapper(communityController.contactUs));

module.exports = router;