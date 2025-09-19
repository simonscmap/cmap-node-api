const router = require('express').Router();
const passport = require('../middleware/passport');

const {
  bulkDownloadController,
  bulkRowCountController,
  bulkDownloadInitController,
} = require('../controllers/data/bulk-download/');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

/**
 * Bulk download request parameters
 * @typedef {Object} BulkDownloadRequest
 * @property {Array<string>} shortNames - Array of dataset short names to download
 * @property {Object} [filters] - Optional filtering constraints
 * @property {Object} [filters.temporal] - Temporal filtering constraints
 * @property {string} filters.temporal.startDate - Start date in ISO format (YYYY-MM-DD)
 * @property {string} filters.temporal.endDate - End date in ISO format (YYYY-MM-DD)
 * @property {Object} [filters.spatial] - Spatial filtering constraints  
 * @property {number} filters.spatial.latMin - Minimum latitude (-90 to 90)
 * @property {number} filters.spatial.latMax - Maximum latitude (-90 to 90)
 * @property {number} filters.spatial.lonMin - Minimum longitude (-180 to 180)
 * @property {number} filters.spatial.lonMax - Maximum longitude (-180 to 180)
 * @property {Object} [filters.depth] - Depth filtering constraints
 * @property {number} filters.depth.min - Minimum depth
 * @property {number} filters.depth.max - Maximum depth
 */

/**
 * Downloads multiple datasets as a ZIP archive with optional filtering
 * 
 * @name POST /data/bulk-download
 * @function
 * @memberof module:routes/bulk-download
 * @param {BulkDownloadRequest} req.body - Request body containing dataset short names and optional filters
 * @returns {application/zip} ZIP archive containing CSV files for each dataset
 * @example
 * // Request body:
 * {
 *   "shortNames": ["dataset1", "dataset2"],
 *   "filters": {
 *     "temporal": {
 *       "startDate": "2020-01-01",
 *       "endDate": "2020-12-31"
 *     },
 *     "spatial": {
 *       "latMin": 10,
 *       "latMax": 50,
 *       "lonMin": -120,
 *       "lonMax": -80
 *     },
 *     "depth": {
 *       "min": 0,
 *       "max": 100
 *     }
 *   }
 * }
 */
router.post(
  '/bulk-download',
  passport.authenticate(['headerapikey', 'jwt', 'guest'], { session: false }),
  asyncControllerWrapper(bulkDownloadController),
);

/**
 * Calculates row counts for multiple datasets with optional filtering
 * 
 * @name POST /data/bulk-download-row-counts
 * @function
 * @memberof module:routes/bulk-download
 * @param {BulkDownloadRequest} req.body - Request body containing dataset short names and optional filters
 * @returns {Object} Object mapping dataset short names to their row counts
 * @example
 * // Request body (same as bulk-download):
 * {
 *   "shortNames": ["dataset1", "dataset2"],
 *   "filters": {
 *     "temporal": {
 *       "startDate": "2020-01-01", 
 *       "endDate": "2020-12-31"
 *     }
 *   }
 * }
 * 
 * // Response:
 * {
 *   "dataset1": 1250,
 *   "dataset2": 3400
 * }
 */
router.post(
  '/bulk-download-row-counts',
  asyncControllerWrapper(bulkRowCountController),
);

/**
 * Initializes bulk download by fetching metadata for requested datasets
 * 
 * @name POST /data/bulk-download-init
 * @function
 * @memberof module:routes/bulk-download
 * @param {Object} req.body - Request body containing dataset short names
 * @param {string[]} req.body.shortNames - Array of dataset short names
 * @returns {Object} Object containing datasets metadata and validation results
 * @example
 * // Request body:
 * {
 *   "shortNames": ["dataset1", "dataset2"]
 * }
 * 
 * // Response:
 * {
 *   "datasetsMetadata": [
 *     {
 *       "shortName": "dataset1",
 *       "metadata": { ... }
 *     }
 *   ]
 * }
 */
router.post(
  '/bulk-download-init',
  asyncControllerWrapper(bulkDownloadInitController),
);

module.exports = router;