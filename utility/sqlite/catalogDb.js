const Database = require('better-sqlite3');
const initializeLogger = require('../../log-service');

const moduleLogger = initializeLogger('utility/sqlite/catalogDb');

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
      sensors, make, regions, datasetType, rowCount, metadataJson
    ) VALUES (
      @datasetId, @shortName, @longName, @description,
      @variableLongNames, @variableShortNames, @distributor, @dataSource,
      @processLevel, @studyDomain, @keywords,
      @latMin, @latMax, @lonMin, @lonMax,
      @timeMin, @timeMax, @depthMin, @depthMax,
      @sensors, @make, @regions, @datasetType, @rowCount, @metadataJson
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

  log.info('regions table populated successfully', { regionCount: regionsData.length });
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

module.exports = {
  createCatalogDatabase,
  populateCatalogDatabase,
  populateRegionsTable,
  serializeDatabase,
};
