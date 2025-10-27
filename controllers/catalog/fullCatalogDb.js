const sql = require('mssql');
const zlib = require('zlib');
const util = require('util');
const pools = require('../../dbHandlers/dbPools');
const fullCatalogQuery = require('../../dbHandlers/fullCatalogQuery');
const getExcludedDatasets = require('../../queries/excludedDatasets');
const nodeCache = require('../../utility/nodeCache');
const initializeLogger = require('../../log-service');
const {
  createCatalogDatabase,
  populateCatalogDatabase,
  populateRegionsTable,
  serializeDatabase,
} = require('../../utility/sqlite/catalogDb');

const gzip = util.promisify(zlib.gzip);

const moduleLogger = initializeLogger('controllers/catalog/fullCatalogDb');

const CACHE_KEY = 'full_catalog_db';
const CACHE_TTL = 86400; // 24 hours in seconds
const SCHEMA_VERSION = '2.0'; // Bump when schema changes (last change: added rowCount column)

/**
 * Get a checksum representing the current state of the catalog data
 * Used for cache invalidation when datasets are added/removed/updated
 * @param {object} pool - Database connection pool
 * @param {object} log - Logger instance
 * @returns {Promise<string>} Checksum string in format "count_maxId_checksum"
 */
const getDatasetChecksum = async (pool, log) => {
  const request = new sql.Request(pool);
  const query = `
    SELECT
      COUNT(*) as dataset_count,
      MAX(ID) as max_id,
      CHECKSUM_AGG(CHECKSUM(ID)) as checksum
    FROM tblDatasets
    WHERE Dataset_Name <> 'z33P4nA1Raj'
  `;

  log.debug('calculating dataset checksum');
  const result = await request.query(query);

  const { dataset_count, max_id, checksum } = result.recordset[0];
  const checksumValue = `${dataset_count}_${max_id}_${Math.abs(checksum || 0)}`;

  log.debug('dataset checksum calculated', { checksumValue });

  return checksumValue;
};

/**
 * Determine dataset type based on makes and sensors
 * @param {string[]} makes - Array of make values
 * @param {string[]} sensors - Array of sensor values
 * @returns {string} Dataset type: 'Model', 'Satellite', or 'In-Situ'
 */
const getDatasetType = (makes = [], sensors = []) => {
  // Convert arrays to lowercase for case-insensitive comparison
  const makesLower = makes.map((make) => make.toLowerCase());
  const sensorsLower = sensors.map((sensor) => sensor.toLowerCase());

  // Make: Model -> Type: Model
  if (makesLower.includes('model')) {
    return 'Model';
  }

  // Make: Observation + Sensor: Satellite -> Type: Satellite
  if (
    makesLower.includes('observation') &&
    sensorsLower.includes('satellite')
  ) {
    return 'Satellite';
  }

  // Else, Type: In-Situ
  return 'In-Situ';
};

module.exports = async (req, res) => {
  const log = moduleLogger.setReqId(req.requestId);

  log.info('full catalog db request received');

  try {
    // Get database pool first (needed for checksum)
    const pool = await pools.dataReadOnlyPool;

    // Calculate current dataset checksum
    const currentChecksum = await getDatasetChecksum(pool, log);

    // Check cache with checksum validation
    const cached = nodeCache.get(CACHE_KEY);
    if (cached && cached.checksum === currentChecksum) {
      log.info('serving full catalog db from cache', {
        checksum: currentChecksum,
        datasetCount: cached.datasetCount,
        compressedSize: cached.buffer.length,
        uncompressedSize: cached.uncompressedSize,
        cacheAge: ((Date.now() - new Date(cached.generatedAt).getTime()) / 1000 / 60).toFixed(1) + ' minutes',
      });
      res.writeHead(200, {
        'Cache-Control': `max-age=${CACHE_TTL}`,
        'Content-Type': 'application/x-sqlite3',
        'Content-Encoding': 'gzip',
        'X-Catalog-Checksum': cached.checksum,
        'X-Catalog-Version': SCHEMA_VERSION,
        'X-Catalog-Dataset-Count': cached.datasetCount.toString(),
        'X-Catalog-Generated-At': cached.generatedAt,
      });
      return res.end(cached.buffer);
    }

    // Log cache status
    if (cached) {
      log.info('cache invalidated - data changed', {
        oldChecksum: cached.checksum,
        newChecksum: currentChecksum,
      });
    } else {
      log.info('cache miss - building fresh catalog');
    }
    // Get excluded datasets
    const excludedDatasets = await getExcludedDatasets(log);
    log.debug('excluded datasets loaded', {
      excludedCount: excludedDatasets.length,
    });

    // Execute catalog query
    const request = new sql.Request(pool);

    // Use full catalog query (includes all searchable fields) and exclude the test dataset
    const query = fullCatalogQuery + `\nAND ds.Dataset_Name <> 'z33P4nA1Raj'`;

    log.debug('executing full catalog query');
    const result = await request.query(query);

    log.debug('query executed successfully', {
      recordCount: result.recordset.length,
    });

    // Helper function to deduplicate comma-separated values
    const deduplicateCommaSeparated = (str) => {
      if (!str) return null;
      const items = str.split(',').map((item) => item.trim());
      return [...new Set(items)].join(', ');
    };

    // Filter out excluded datasets and transform to camelCase
    const catalogData = result.recordset
      .filter((record) => !excludedDatasets.includes(record.Short_Name))
      .map((record) => {
        // Parse makes and sensors for dataset type calculation
        const makes = record.Make ? record.Make.split(',').map((m) => m.trim()) : [];
        const sensors = record.Sensors ? record.Sensors.split(',').map((s) => s.trim()) : [];

        return {
          productType: record.Product_Type,
          shortName: record.Short_Name,
          longName: record.Long_Name,
          description: record.Description,
          iconUrl: record.Icon_URL,
          datasetReleaseDate: record.Dataset_Release_Date,
          datasetHistory: record.Dataset_History,
          datasetVersion: record.Dataset_Version,
          tableName: record.Table_Name,
          processLevel: record.Process_Level,
          make: record.Make,
          dataSource: record.Data_Source,
          distributor: record.Distributor,
          acknowledgement: record.Acknowledgement,
          datasetId: record.Dataset_ID,
          spatialResolution: record.Spatial_Resolution,
          temporalResolution: record.Temporal_Resolution,
          studyDomain: record.Study_Domain,
          latMin: record.Lat_Min,
          latMax: record.Lat_Max,
          lonMin: record.Lon_Min,
          lonMax: record.Lon_Max,
          depthMin: record.Depth_Min,
          depthMax: record.Depth_Max,
          timeMin: record.Time_Min,
          timeMax: record.Time_Max,
          sensors: sensors.length > 0 ? [...new Set(sensors)].join(', ') : null,
          visualize: record.Visualize,
          rowCount: record.Row_Count,
          regions: record.Regions,
          references: record.References,
          datasetType: getDatasetType(makes, sensors),
          // Deduplicate these fields which contain comma-separated lists from SQL aggregation
          variableLongNames: deduplicateCommaSeparated(record.Variable_Long_Names),
          variableShortNames: deduplicateCommaSeparated(record.Variable_Short_Names),
          keywords: deduplicateCommaSeparated(record.Keywords),
        };
      });

    log.info('catalog data prepared', {
      totalDatasets: catalogData.length,
      excludedCount: result.recordset.length - catalogData.length,
    });

    // Fetch regions data
    log.debug('fetching regions data');
    const regionsRequest = new sql.Request(pool);
    const regionsResult = await regionsRequest.query('SELECT Region_ID, Region_Name FROM tblRegions ORDER BY Region_Name');
    log.debug('regions data fetched', { regionCount: regionsResult.recordset.length });

    // Create SQLite database
    const db = createCatalogDatabase(log);

    // Populate database with catalog data
    populateCatalogDatabase(db, catalogData, log);

    // Populate regions table
    populateRegionsTable(db, regionsResult.recordset, log);

    // Serialize database to buffer
    const dbBuffer = serializeDatabase(db, log);

    // Close database
    db.close();

    const uncompressedSize = dbBuffer.length;

    // Gzip the SQLite database
    const gzippedBuffer = await gzip(dbBuffer);
    const compressedSize = gzippedBuffer.length;

    const generatedAt = new Date().toISOString();

    log.info('catalog database compressed', {
      uncompressedSize,
      compressedSize,
      compressionRatio:
        ((1 - compressedSize / uncompressedSize) * 100).toFixed(2) + '%',
      datasetCount: catalogData.length,
      checksum: currentChecksum,
    });

    // Cache the gzipped buffer with version metadata
    nodeCache.set(
      CACHE_KEY,
      {
        buffer: gzippedBuffer,
        checksum: currentChecksum,
        datasetCount: catalogData.length,
        uncompressedSize,
        generatedAt,
        schemaVersion: SCHEMA_VERSION,
      },
      CACHE_TTL,
    );

    log.info('full catalog db cached', {
      cacheKey: CACHE_KEY,
      checksum: currentChecksum,
      ttl: CACHE_TTL,
    });

    // Send gzipped response with version headers
    res.writeHead(200, {
      'Cache-Control': `max-age=${CACHE_TTL}`,
      'Content-Type': 'application/x-sqlite3',
      'Content-Encoding': 'gzip',
      'X-Catalog-Checksum': currentChecksum,
      'X-Catalog-Version': SCHEMA_VERSION,
      'X-Catalog-Dataset-Count': catalogData.length.toString(),
      'X-Catalog-Generated-At': generatedAt,
    });
    res.end(gzippedBuffer);
  } catch (error) {
    log.error('error generating full catalog database', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'server_error',
      message: 'Error generating full catalog database',
    });
  }
};
