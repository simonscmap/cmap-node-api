const router = require('express').Router();
const passport = require('../middleware/passport');

const {
  bulkDownloadController,
  bulkRowCountController,
  bulkDownloadInitController,
} = require('../controllers/data/bulk-download/');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// Bulk-download
router.post(
  '/bulk-download',
  passport.authenticate(['headerapikey', 'jwt', 'guest'], { session: false }),
  asyncControllerWrapper(bulkDownloadController),
);

router.post(
  '/bulk-download-row-counts',
  asyncControllerWrapper(bulkRowCountController),
);

router.post(
  '/bulk-download-init',
  asyncControllerWrapper(bulkDownloadInitController),
);

module.exports = router;