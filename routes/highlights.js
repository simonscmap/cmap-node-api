const router = require('express').Router();
const highlightsController = require('../controllers/highlights');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// Signup route
router.get('/', asyncControllerWrapper(highlightsController));

module.exports = router;
