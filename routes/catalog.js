const router = require('express').Router();
const ctrCatalog = require('../controllers/catalog');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

/////////////////// catalog root route  ///////////////////
router.get('/', asyncControllerWrapper(ctrCatalog.retrieve));

module.exports = router;