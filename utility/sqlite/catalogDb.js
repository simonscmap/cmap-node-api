const crypto = require('crypto');
const Database = require('better-sqlite3');

/**
 * Creates and initializes an in-memory SQLite database for catalog search
 * @param {Object} log - Logger instance
 * @returns {Database} - SQLite database instance
 */
const createCatalogDatabase = (log) => {
  log.debug('creating in-memory SQLite database');

  // Create in-memory database
  const db = new Database(':memory:');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  log.debug('creating datasets table');

  // Create main datasets table
  db.exec(`
    CREATE TABLE datasets (
      datasetId INTEGER PRIMARY KEY,
      shortName TEXT NOT NULL,
      longName TEXT,
      description TEXT,

      -- Searchable fields
      variableLongNames TEXT,
      variableShortNames TEXT,
      distributor TEXT,
      dataSource TEXT,
      processLevel TEXT,
      studyDomain TEXT,
      keywords TEXT,

      -- Spatial bounds
      latMin REAL,
      latMax REAL,
      lonMin REAL,
      lonMax REAL,

      -- Temporal bounds (ISO8601 strings)
      timeMin TEXT,
      timeMax TEXT,

      -- Depth bounds
      depthMin REAL,
      depthMax REAL,

      -- Sensors (comma-separated string for FTS search)
      sensors TEXT,

      -- Make (for dataset type calculation and search)
      make TEXT,

      -- Regions (comma-separated string for FTS search)
      regions TEXT,

      -- Dataset Type (calculated: Model, Satellite, or In-Situ)
      datasetType TEXT,

      -- Row count for the dataset
      rowCount REAL,

      -- Resolution fields (for row count estimation eligibility)
      spatialResolution TEXT,
      temporalResolution TEXT,

      -- Has depth flag
      hasDepth INTEGER,

      -- Table count (number of distinct tables for this dataset)
      tableCount INTEGER,

      -- Full metadata as JSON blob
      metadataJson TEXT NOT NULL
    );
  `);

  log.debug('creating FTS5 virtual table');

  // Create FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE datasets_fts USING fts5(
      shortName,
      longName,
      description,
      variableLongNames,
      variableShortNames,
      sensors,
      distributor,
      dataSource,
      keywords,
      processLevel,
      studyDomain,
      make,
      regions,
      datasetType,
      content='datasets',
      content_rowid='datasetId',
      tokenize='porter unicode61'
    );
  `);

  log.debug('creating triggers to sync FTS table');

  // Triggers to keep FTS in sync with main table
  db.exec(`
    CREATE TRIGGER datasets_ai AFTER INSERT ON datasets BEGIN
      INSERT INTO datasets_fts(rowid, shortName, longName, description, variableLongNames,
        variableShortNames, sensors, distributor, dataSource, keywords, processLevel, studyDomain,
        make, regions, datasetType)
      VALUES (new.datasetId, new.shortName, new.longName, new.description, new.variableLongNames,
        new.variableShortNames, new.sensors, new.distributor, new.dataSource, new.keywords,
        new.processLevel, new.studyDomain, new.make, new.regions, new.datasetType);
    END;
  `);

  db.exec(`
    CREATE TRIGGER datasets_ad AFTER DELETE ON datasets BEGIN
      DELETE FROM datasets_fts WHERE rowid = old.datasetId;
    END;
  `);

  db.exec(`
    CREATE TRIGGER datasets_au AFTER UPDATE ON datasets BEGIN
      UPDATE datasets_fts SET
        shortName = new.shortName,
        longName = new.longName,
        description = new.description,
        variableLongNames = new.variableLongNames,
        variableShortNames = new.variableShortNames,
        sensors = new.sensors,
        distributor = new.distributor,
        dataSource = new.dataSource,
        keywords = new.keywords,
        processLevel = new.processLevel,
        studyDomain = new.studyDomain,
        make = new.make,
        regions = new.regions,
        datasetType = new.datasetType
      WHERE rowid = new.datasetId;
    END;
  `);

  log.debug('creating spatial and temporal indexes');

  // Create indexes for spatial/temporal filtering
  db.exec(`
    CREATE INDEX idx_spatial ON datasets(latMin, latMax, lonMin, lonMax);
  `);

  db.exec(`
    CREATE INDEX idx_temporal ON datasets(timeMin, timeMax);
  `);

  db.exec(`
    CREATE INDEX idx_depth ON datasets(depthMin, depthMax);
  `);

  log.debug('creating regions table');

  // Create regions reference table
  db.exec(`
    CREATE TABLE regions (
      regionId INTEGER PRIMARY KEY,
      regionName TEXT NOT NULL
    );
  `);

  log.info('SQLite catalog database created successfully');

  return db;
};

/**
 * Populates the SQLite database with catalog data
 * @param {Database} db - SQLite database instance
 * @param {Array} catalogData - Array of dataset objects from SQL Server
 * @param {Object} log - Logger instance
 */
const populateCatalogDatabase = (db, catalogData, log) => {
  log.debug('populating database', { datasetCount: catalogData.length });

  // Prepare insert statement
  const insert = db.prepare(`
    INSERT INTO datasets (
      datasetId, shortName, longName, description,
      variableLongNames, variableShortNames, distributor, dataSource,
      processLevel, studyDomain, keywords,
      latMin, latMax, lonMin, lonMax,
      timeMin, timeMax, depthMin, depthMax,
      sensors, make, regions, datasetType, rowCount,
      spatialResolution, temporalResolution,
      hasDepth, tableCount, metadataJson
    ) VALUES (
      @datasetId, @shortName, @longName, @description,
      @variableLongNames, @variableShortNames, @distributor, @dataSource,
      @processLevel, @studyDomain, @keywords,
      @latMin, @latMax, @lonMin, @lonMax,
      @timeMin, @timeMax, @depthMin, @depthMax,
      @sensors, @make, @regions, @datasetType, @rowCount,
      @spatialResolution, @temporalResolution,
      @hasDepth, @tableCount, @metadataJson
    )
  `);

  // Use transaction for better performance
  const insertMany = db.transaction((datasets) => {
    for (const dataset of datasets) {
      insert.run({
        datasetId: dataset.datasetId,
        shortName: dataset.shortName,
        longName: dataset.longName,
        description: dataset.description,
        variableLongNames: dataset.variableLongNames,
        variableShortNames: dataset.variableShortNames,
        distributor: dataset.distributor,
        dataSource: dataset.dataSource,
        processLevel: dataset.processLevel,
        studyDomain: dataset.studyDomain,
        keywords: dataset.keywords,
        latMin: dataset.latMin,
        latMax: dataset.latMax,
        lonMin: dataset.lonMin,
        lonMax: dataset.lonMax,
        timeMin: dataset.timeMin,
        timeMax: dataset.timeMax,
        depthMin: dataset.depthMin,
        depthMax: dataset.depthMax,
        sensors: dataset.sensors,
        make: dataset.make,
        regions: dataset.regions,
        datasetType: dataset.datasetType,
        rowCount: dataset.rowCount,
        spatialResolution: dataset.spatialResolution,
        temporalResolution: dataset.temporalResolution,
        hasDepth: dataset.hasDepth ? 1 : 0,
        tableCount: dataset.tableCount,
        metadataJson: JSON.stringify(dataset),
      });
    }
  });

  insertMany(catalogData);

  log.info('database populated successfully', { datasetCount: catalogData.length });
};

/**
 * Populates the regions table with data from tblRegions
 * @param {Database} db - SQLite database instance
 * @param {Array} regionsData - Array of region objects from SQL Server
 * @param {Object} log - Logger instance
 */
const populateRegionsTable = (db, regionsData, log) => {
  log.debug('populating regions table', { regionCount: regionsData.length });

  // Prepare insert statement
  const insert = db.prepare(`
    INSERT INTO regions (regionId, regionName)
    VALUES (@regionId, @regionName)
  `);

  // Use transaction for better performance
  const insertMany = db.transaction((regions) => {
    for (const region of regions) {
      insert.run({
        regionId: region.Region_ID,
        regionName: region.Region_Name,
      });
    }
  });

  insertMany(regionsData);

  log.info('regions table populated successfully', {
    regionCount: regionsData.length,
  });
};

/**
 * Serializes the SQLite database to a buffer
 * @param {Database} db - SQLite database instance
 * @param {Object} log - Logger instance
 * @returns {Buffer} - Database as buffer
 */
const serializeDatabase = (db, log) => {
  log.debug('serializing database to buffer');

  const buffer = db.serialize();

  log.debug('database serialized', { bufferSize: buffer.length });

  return buffer;
};

/**
 * Returns hardcoded spatial resolution mappings
 * Resolution string -> numeric degree value (or null for irregular) with units
 *
 * NOTE: Some datasets have kilometer labels but their actual data resolution is
 * degree-based.
 * Confirmed values: 70km X 70km and 9km X 9km were verified by examining actual
 * data points and measuring differences in spatial values.
 * Estimated values: 4km X 4km and 25km X 25km are estimates as we do not have
 * datasets to confirm these resolutions.
 *
 * @returns {Array<{resolution: string, value: number|null, units: string|null}>}
 */
const getSpatialResolutionMappings = () => {
  return [
    { resolution: 'Irregular', value: null, units: null },
    { resolution: '15 arc-second interval grid', value: 0.004166666666667, units: 'degrees' }, // 15 ÷ 3600
    { resolution: '1/48° X 1/48°', value: 0.020833333333333, units: 'degrees' }, // 1 ÷ 48
    { resolution: '1/25° X 1/25°', value: 0.04, units: 'degrees' },              // 1 ÷ 25 = 0.04 (exact)
    { resolution: '1/12° X 1/12°', value: 0.083333333333333, units: 'degrees' }, // 1 ÷ 12
    { resolution: '1/8° X 1/8°', value: 0.125, units: 'degrees' },               // 1 ÷ 8 = 0.125 (exact)
    { resolution: '1/4° X 1/4°', value: 0.25, units: 'degrees' },                // 1 ÷ 4 = 0.25 (exact)
    { resolution: '1/2° X 1/2°', value: 0.5, units: 'degrees' },                 // 1 ÷ 2 = 0.5 (exact)
    { resolution: '1° X 1°', value: 1, units: 'degrees' },                       // 1 degree (exact)
    { resolution: '4km X 4km', value: 0.041666666666667, units: 'degrees' },     // Estimated 1/24°
    { resolution: '9km X 9km', value: 0.083333333333333, units: 'degrees' },     // 1/12°
    { resolution: '25km X 25km', value: 0.125, units: 'degrees' },               // Estimated 1/8°
    { resolution: '70km X 70km', value: 0.25, units: 'degrees' },                // 1/4°
  ];
};

/**
 * Returns hardcoded temporal resolution mappings
 * Resolution string -> numeric seconds value (or null for irregular/monthly climatology) with units
 * @returns {Array<{resolution: string, value: number|null, units: string|null}>}
 */
const getTemporalResolutionMappings = () => {
  return [
    { resolution: 'Irregular', value: null, units: null },
    { resolution: 'Monthly Climatology', value: null, units: null },
    { resolution: '1/6 s', value: 0.166666666666667, units: 'seconds' },
    { resolution: 'One Second', value: 1, units: 'seconds' },
    { resolution: 'Three Seconds', value: 3, units: 'seconds' },
    { resolution: '10 Seconds', value: 10, units: 'seconds' },
    { resolution: '30 seconds', value: 30, units: 'seconds' },
    { resolution: 'One Minute', value: 60, units: 'seconds' },
    { resolution: 'Three Minutes', value: 180, units: 'seconds' },
    { resolution: 'Hourly', value: 3600, units: 'seconds' },
    { resolution: 'Six Hourly', value: 21600, units: 'seconds' },
    { resolution: 'Daily', value: 86400, units: 'seconds' },
    { resolution: 'Three Days', value: 259200, units: 'seconds' },
    { resolution: 'Weekly', value: 604800, units: 'seconds' },
    // Eight Day Running = 8-day moving average computed daily, so data has daily resolution
    { resolution: 'Eight Day Running', value: 86400, units: 'seconds' },
    { resolution: 'Eight Days', value: 691200, units: 'seconds' },
    { resolution: 'Monthly', value: 2592000, units: 'seconds' },
    { resolution: 'Annual', value: 31536000, units: 'seconds' },
  ];
};

/**
 * Creates spatial resolution mappings table in SQLite database
 * @param {Database} db - SQLite database instance
 * @param {Object} log - Logger instance
 */
const createSpatialResolutionMappingsTable = (db, log) => {
  log.debug('creating spatial_resolution_mappings table');

  db.exec(`
    CREATE TABLE spatial_resolution_mappings (
      resolution TEXT PRIMARY KEY,
      value REAL,
      units TEXT
    );
  `);

  log.debug('spatial_resolution_mappings table created');
};

/**
 * Creates temporal resolution mappings table in SQLite database
 * @param {Database} db - SQLite database instance
 * @param {Object} log - Logger instance
 */
const createTemporalResolutionMappingsTable = (db, log) => {
  log.debug('creating temporal_resolution_mappings table');

  db.exec(`
    CREATE TABLE temporal_resolution_mappings (
      resolution TEXT PRIMARY KEY,
      value REAL,
      units TEXT
    );
  `);

  log.debug('temporal_resolution_mappings table created');
};

/**
 * Creates depth tables (darwin_depth, pisces_depth, woa_depth) in SQLite database
 * @param {Database} db - SQLite database instance
 * @param {Object} log - Logger instance
 */
const createDepthTables = (db, log) => {
  log.debug('creating darwin_depth, pisces_depth, and woa_depth tables');

  db.exec(`
    CREATE TABLE darwin_depth (
      depth_level REAL
    );
  `);

  db.exec(`
    CREATE TABLE pisces_depth (
      depth_level REAL
    );
  `);

  db.exec(`
    CREATE TABLE woa_depth (
      depth_level REAL
    );
  `);

  log.debug('depth tables created');
};

/**
 * Creates dataset_depth_models table in SQLite database
 * @param {Database} db - SQLite database instance
 * @param {Object} log - Logger instance
 */
const createDatasetDepthModelsTable = (db, log) => {
  log.debug('creating dataset_depth_models table');

  db.exec(`
    CREATE TABLE dataset_depth_models (
      short_name TEXT PRIMARY KEY,
      depth_model TEXT
    );
  `);

  log.debug('dataset_depth_models table created');
};

/**
 * Populates spatial resolution mappings table with hardcoded values
 * @param {Database} db - SQLite database instance
 * @param {Object} log - Logger instance
 */
const populateSpatialResolutionMappings = (db, log) => {
  log.debug('populating spatial_resolution_mappings table');

  const mappings = getSpatialResolutionMappings();

  const insert = db.prepare(`
    INSERT INTO spatial_resolution_mappings (resolution, value, units)
    VALUES (@resolution, @value, @units)
  `);

  const insertMany = db.transaction((data) => {
    for (const mapping of data) {
      insert.run({
        resolution: mapping.resolution,
        value: mapping.value,
        units: mapping.units,
      });
    }
  });

  insertMany(mappings);

  log.info('spatial_resolution_mappings table populated', { mappingCount: mappings.length });
};

/**
 * Populates temporal resolution mappings table with hardcoded values
 * @param {Database} db - SQLite database instance
 * @param {Object} log - Logger instance
 */
const populateTemporalResolutionMappings = (db, log) => {
  log.debug('populating temporal_resolution_mappings table');

  const mappings = getTemporalResolutionMappings();

  const insert = db.prepare(`
    INSERT INTO temporal_resolution_mappings (resolution, value, units)
    VALUES (@resolution, @value, @units)
  `);

  const insertMany = db.transaction((data) => {
    for (const mapping of data) {
      insert.run({
        resolution: mapping.resolution,
        value: mapping.value,
        units: mapping.units,
      });
    }
  });

  insertMany(mappings);

  log.info('temporal_resolution_mappings table populated', { mappingCount: mappings.length });
};

/**
 * Populates depth tables from backend query results
 * @param {Database} db - SQLite database instance
 * @param {Array} darwinDepthData - Array of {depth_level} objects from tblDarwin_Depth
 * @param {Array} piscesDepthData - Array of {depth_level} objects from tblPisces_Depth
 * @param {Array} woaDepthData - Array of {depth_level} objects from tblWOA_Depth
 * @param {Object} log - Logger instance
 */
const populateDepthTables = (db, darwinDepthData, piscesDepthData, woaDepthData, log) => {
  log.debug('populating depth tables', {
    darwinCount: darwinDepthData.length,
    piscesCount: piscesDepthData.length,
    woaCount: woaDepthData.length,
  });

  const darwinInsert = db.prepare(`
    INSERT INTO darwin_depth (depth_level)
    VALUES (@depth)
  `);

  const piscesInsert = db.prepare(`
    INSERT INTO pisces_depth (depth_level)
    VALUES (@depth)
  `);

  const woaInsert = db.prepare(`
    INSERT INTO woa_depth (depth_level)
    VALUES (@depth)
  `);

  const insertDarwin = db.transaction((data) => {
    for (const row of data) {
      darwinInsert.run({ depth: row.depth_level });
    }
  });

  const insertPisces = db.transaction((data) => {
    for (const row of data) {
      piscesInsert.run({ depth: row.depth_level });
    }
  });

  const insertWoa = db.transaction((data) => {
    for (const row of data) {
      woaInsert.run({ depth: row.depth_level });
    }
  });

  insertDarwin(darwinDepthData);
  insertPisces(piscesDepthData);
  insertWoa(woaDepthData);

  log.info('depth tables populated', {
    darwinCount: darwinDepthData.length,
    piscesCount: piscesDepthData.length,
    woaCount: woaDepthData.length,
  });
};

/**
 * Populates dataset_depth_models table by searching catalog for Darwin/PISCES/WOA datasets
 * @param {Database} db - SQLite database instance
 * @param {Array} catalogData - Array of dataset objects
 * @param {Object} log - Logger instance
 */
const populateDatasetDepthModels = (db, catalogData, log) => {
  log.debug('searching catalog for Darwin/PISCES/WOA datasets', {
    totalDatasets: catalogData.length,
  });

  const depthModelDatasets = [];

  for (const dataset of catalogData) {
    if (!dataset.tableName) continue;

    const tableNameLower = dataset.tableName.toLowerCase();

    if (tableNameLower.includes('darwin')) {
      depthModelDatasets.push({
        shortName: dataset.shortName,
        depthModel: 'darwin',
      });
    } else if (tableNameLower.includes('pisces')) {
      depthModelDatasets.push({
        shortName: dataset.shortName,
        depthModel: 'pisces',
      });
    } else if (tableNameLower.includes('woa')) {
      depthModelDatasets.push({
        shortName: dataset.shortName,
        depthModel: 'woa',
      });
    }
  }

  log.debug('found datasets with depth models', {
    depthModelCount: depthModelDatasets.length,
  });

  if (depthModelDatasets.length === 0) {
    log.info('no Darwin/PISCES/WOA datasets found in catalog');
    return;
  }

  const insert = db.prepare(`
    INSERT INTO dataset_depth_models (short_name, depth_model)
    VALUES (@shortName, @depthModel)
  `);

  const insertMany = db.transaction((data) => {
    for (const dataset of data) {
      insert.run({
        shortName: dataset.shortName,
        depthModel: dataset.depthModel,
      });
    }
  });

  insertMany(depthModelDatasets);

  log.info('dataset_depth_models table populated', {
    depthModelCount: depthModelDatasets.length,
  });
};

const computeSchemaHash = (db, log) => {
  const schemaRows = db.prepare(`
    SELECT type, name, sql FROM sqlite_master
    WHERE sql IS NOT NULL
    AND name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `).all();

  // Hash the schema definitions
  const schemaString = JSON.stringify(schemaRows);
  const fullHash = crypto.createHash('md5').update(schemaString).digest('hex');
  const shortHash = fullHash.substring(0, 8);

  log.info('schema hash computed', {
    schemaHash: shortHash,
    tableCount: schemaRows.filter((r) => r.type === 'table').length,
    indexCount: schemaRows.filter((r) => r.type === 'index').length,
  });

  return shortHash;
};

module.exports = {
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
};
