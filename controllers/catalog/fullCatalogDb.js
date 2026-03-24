const sql = require('mssql');
const zlib = require('zlib');
const util = require('util');
const pools = require('../../dbHandlers/dbPools');
const fullCatalogQuery = require('../../dbHandlers/fullCatalogQuery');
const getExcludedDatasets = require('../../queries/excludedDatasets');
const nodeCache = require('../../utility/nodeCache');
const initializeLogger = require('../../log-service');
const { getDatasetType } = require('../../utility/datasetType');
const {
  createCatalogDatabase,
  populateCatalogDatabase,
  populateRegionsTable,
  serializeDatabase,
  computeSchemaHash,
  createSpatialResolutionMappingsTable,
  createTemporalResolutionMappingsTable,
  createDepthTables,
  createDatasetDepthModelsTable,
  populateSpatialResolutionMappings,
  populateTemporalResolutionMappings,
  populateDepthTables,
  populateDatasetDepthModels,
} = require('../../utility/sqlite/catalogDb');

const gzip = util.promisify(zlib.gzip);

const moduleLogger = initializeLogger('controllers/catalog/fullCatalogDb');

const CACHE_KEY = 'full_catalog_db';
const CACHE_TTL = 86400; // 24 hours in seconds

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
 * Clamp latitude to valid range [-90, 90]
 * @param {number|null} lat - Latitude value
 * @param {string} datasetName - Dataset name for tracking
 * @param {string} coordType - Coordinate type ('latMin' or 'latMax')
 * @param {object} stats - Statistics object to track clamped values
 * @returns {number|null} Clamped latitude
 */
const clampLatitude = (lat, datasetName, coordType, stats) => {
  if (lat == null) return null;

  const clamped = Math.max(-90, Math.min(90, lat));

  if (clamped !== lat) {
    stats.clampedCoordinates.push({
      dataset: datasetName,
      coordinate: coordType,
      original: lat,
      clamped: clamped,
    });
  }

  return clamped;
};

/**
 * Clamp longitude to valid range [-180, 180]
 * @param {number|null} lon - Longitude value
 * @param {string} datasetName - Dataset name for tracking
 * @param {string} coordType - Coordinate type ('lonMin' or 'lonMax')
 * @param {object} stats - Statistics object to track clamped values
 * @returns {number|null} Clamped longitude
 */
const clampLongitude = (lon, datasetName, coordType, stats) => {
  if (lon == null) return null;

  const clamped = Math.max(-180, Math.min(180, lon));

  if (clamped !== lon) {
    stats.clampedCoordinates.push({
      dataset: datasetName,
      coordinate: coordType,
      original: lon,
      clamped: clamped,
    });
  }

  return clamped;
};

module.exports = async (req, res) => {
  const log = moduleLogger.setReqId(req.requestId);

  log.info('full catalog db request received', { method: req.method });

  try {
    // Get database pool first (needed for checksum)
    const pool = await pools.dataReadOnlyPool;

    // Calculate current dataset checksum
    const currentChecksum = await getDatasetChecksum(pool, log);

    // For HEAD requests, return headers only (for version checking)
    if (req.method === 'HEAD') {
      const cached = nodeCache.get(CACHE_KEY);
      if (cached && cached.checksum === currentChecksum) {
        log.info('head request - returning cached metadata', {
          checksum: currentChecksum,
          schemaHash: cached.schemaHash,
        });
        res.writeHead(200, {
          'Cache-Control': `max-age=${CACHE_TTL}`,
          'Content-Type': 'application/x-sqlite3',
          'Content-Encoding': 'gzip',
          'X-Catalog-Checksum': cached.checksum,
          'X-Catalog-Schema-Hash': cached.schemaHash,
          'X-Catalog-Dataset-Count': cached.datasetCount.toString(),
          'X-Catalog-Generated-At': cached.generatedAt,
        });
        return res.end();
      }

      // No cache or stale cache - query dataset count for HEAD response
      log.info('head request - no valid cache, returning checksum only');
      const request = new sql.Request(pool);
      const countResult = await request.query(
        "SELECT COUNT(*) as count FROM tblDatasets WHERE Dataset_Name <> 'z33P4nA1Raj'",
      );
      const datasetCount = countResult.recordset[0].count;

      res.writeHead(200, {
        'Cache-Control': `max-age=${CACHE_TTL}`,
        'Content-Type': 'application/x-sqlite3',
        'Content-Encoding': 'gzip',
        'X-Catalog-Checksum': currentChecksum,
        'X-Catalog-Dataset-Count': datasetCount.toString(),
        'X-Catalog-Generated-At': new Date().toISOString(),
      });
      return res.end();
    }

    // Check cache with checksum validation
    const cached = nodeCache.get(CACHE_KEY);
    if (cached && cached.checksum === currentChecksum) {
      log.info('serving full catalog db from cache', {
        checksum: currentChecksum,
        schemaHash: cached.schemaHash,
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
        'X-Catalog-Schema-Hash': cached.schemaHash,
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

    // Initialize statistics for tracking clamped coordinates
    const clampingStats = {
      clampedCoordinates: [],
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
          latMin: clampLatitude(record.Lat_Min, record.Short_Name, 'latMin', clampingStats),
          latMax: clampLatitude(record.Lat_Max, record.Short_Name, 'latMax', clampingStats),
          lonMin: clampLongitude(record.Lon_Min, record.Short_Name, 'lonMin', clampingStats),
          lonMax: clampLongitude(record.Lon_Max, record.Short_Name, 'lonMax', clampingStats),
          depthMin: record.Depth_Min,
          depthMax: record.Depth_Max,
          timeMin: record.Time_Min,
          timeMax: record.Time_Max,
          sensors: sensors.length > 0 ? [...new Set(sensors)].join(', ') : null,
          visualize: record.Visualize,
          hasDepth: record.Has_Depth === 1,
          rowCount: record.Row_Count,
          tableCount: record.Table_Count,
          regions: record.Regions,
          references: record.References,
          datasetType: getDatasetType(makes, sensors),
          // Deduplicate these fields which contain comma-separated lists from SQL aggregation
          variableLongNames: deduplicateCommaSeparated(record.Variable_Long_Names),
          variableShortNames: deduplicateCommaSeparated(record.Variable_Short_Names),
          keywords: deduplicateCommaSeparated(record.Keywords),
          servers: record.Servers,
          programs: record.Programs || null,
        };
      });

    log.info('catalog data prepared', {
      totalDatasets: catalogData.length,
      excludedCount: result.recordset.length - catalogData.length,
    });

    // Log summary of clamped coordinates if any were found
    if (clampingStats.clampedCoordinates.length > 0) {
      const affectedDatasets = [...new Set(clampingStats.clampedCoordinates.map((c) => c.dataset))];

      log.warn('geographic coordinates clamped to valid range', {
        totalCoordinatesClamped: clampingStats.clampedCoordinates.length,
        affectedDatasets: affectedDatasets.length,
        datasets: affectedDatasets,
        details: clampingStats.clampedCoordinates,
      });
    } else {
      log.debug('no coordinate clamping needed - all values within valid range');
    }

    // Fetch regions data
    log.debug('fetching regions data');
    const regionsRequest = new sql.Request(pool);
    const regionsResult = await regionsRequest.query('SELECT Region_ID, Region_Name FROM tblRegions ORDER BY Region_Name');

    // Filter regions to only those actually used by datasets
    let usedRegionNames = new Set();
    for (let i = 0; i < catalogData.length; i++) {
      let dataset = catalogData[i];
      if (dataset.regions) {
        let regionList = dataset.regions.split(',');
        for (let j = 0; j < regionList.length; j++) {
          usedRegionNames.add(regionList[j].trim());
        }
      }
    }

    let allRegions = regionsResult.recordset;
    let usedRegions = allRegions.filter(function(r) {
      return usedRegionNames.has(r.Region_Name);
    });

    let excludedRegions = allRegions
      .filter(function(r) { return !usedRegionNames.has(r.Region_Name); })
      .map(function(r) { return r.Region_Name; });

    log.debug('regions data fetched and filtered', {
      totalRegions: allRegions.length,
      usedRegions: usedRegions.length,
      excludedRegions: excludedRegions,
    });

    const darwinDepthRequest = new sql.Request(pool);
    const darwinDepthResult = await darwinDepthRequest.query('SELECT depth_level FROM tblDarwin_Depth ORDER BY depth_level');

    const piscesDepthRequest = new sql.Request(pool);
    const piscesDepthResult = await piscesDepthRequest.query('SELECT depth_level FROM tblPisces_Depth ORDER BY depth_level');

    const woaDepthRequest = new sql.Request(pool);
    const woaDepthResult = await woaDepthRequest.query('SELECT depth_level FROM tblWOA_Depth ORDER BY depth_level');

    // Create SQLite database
    const db = createCatalogDatabase(log);

    // Populate database with catalog data
    populateCatalogDatabase(db, catalogData, log);

    // Populate regions table (filtered to only regions used by datasets)
    populateRegionsTable(db, usedRegions, log);

    // Create and populate estimation tables
    log.debug('creating estimation tables');
    createSpatialResolutionMappingsTable(db, log);
    createTemporalResolutionMappingsTable(db, log);
    createDepthTables(db, log);
    createDatasetDepthModelsTable(db, log);

    log.debug('populating estimation tables');
    populateSpatialResolutionMappings(db, log);
    populateTemporalResolutionMappings(db, log);
    populateDepthTables(db, darwinDepthResult.recordset, piscesDepthResult.recordset, woaDepthResult.recordset, log);
    populateDatasetDepthModels(db, catalogData, log);

    const schemaHash = computeSchemaHash(db, log);

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
      schemaHash,
    });

    // Cache the gzipped buffer with version metadata
    nodeCache.set(
      CACHE_KEY,
      {
        buffer: gzippedBuffer,
        checksum: currentChecksum,
        schemaHash,
        datasetCount: catalogData.length,
        uncompressedSize,
        generatedAt,
      },
      CACHE_TTL,
    );

    log.info('full catalog db cached', {
      cacheKey: CACHE_KEY,
      checksum: currentChecksum,
      schemaHash,
      ttl: CACHE_TTL,
    });

    // Send gzipped response with version headers
    res.writeHead(200, {
      'Cache-Control': `max-age=${CACHE_TTL}`,
      'Content-Type': 'application/x-sqlite3',
      'Content-Encoding': 'gzip',
      'X-Catalog-Checksum': currentChecksum,
      'X-Catalog-Schema-Hash': schemaHash,
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
