/**
 * SqliteSearchTester - Execute catalog searches against local SQLite database
 * Supports multiple search strategies (FTS, LIKE) with configurable field exclusion
 */

const Database = require('better-sqlite3');
const chalk = require('chalk');

class SqliteSearchTester {
  constructor(databasePath) {
    this.db = new Database(databasePath, { readonly: true });
    // No need to set WAL mode for readonly database
  }

  /**
   * Execute search based on strategy configuration
   * @param {string} query - Search query text
   * @param {Object} filters - Spatial/temporal/depth filters
   * @param {Object} strategy - Search strategy configuration
   * @returns {Promise<Array>} Array of dataset results
   */
  async search(query, filters, strategy) {
    const { mode, excludeFields = [], useRanking = true, phraseMatch = false } = strategy;

    if (mode === 'fts') {
      return this.searchFts(query, filters, { excludeFields, useRanking });
    } else if (mode === 'like') {
      return this.searchLike(query, filters, { excludeFields, phraseMatch });
    } else {
      throw new Error(`Unknown search mode: ${mode}`);
    }
  }

  /**
   * FTS5-based search with field exclusion support
   * @param {string} query - Search query text
   * @param {Object} filters - Spatial/temporal/depth filters
   * @param {Object} options - Search options
   * @returns {Array} Array of dataset results
   */
  searchFts(query, filters, options = {}) {
    const { excludeFields = [], useRanking = true } = options;

    // Build FTS query with field exclusion
    let ftsQuery = '';
    if (query && query.trim()) {
      if (excludeFields.length > 0) {
        // Use field exclusion syntax: {field1 field2}: query
        const excludedFieldsStr = excludeFields.join(' ');
        ftsQuery = `{${excludedFieldsStr}}: ${this.escapeFtsQuery(query)}`;
      } else {
        ftsQuery = this.escapeFtsQuery(query);
      }
    }

    // Build base query
    let sql;
    let params = {};

    if (ftsQuery) {
      // Text search with optional ranking - join FTS with main table
      if (useRanking) {
        sql = `
          SELECT
            d.datasetId,
            d.shortName,
            d.longName,
            d.description,
            d.variableShortNames,
            d.variableLongNames,
            d.distributor,
            d.dataSource,
            d.keywords,
            d.processLevel,
            d.studyDomain,
            d.latMin,
            d.latMax,
            d.lonMin,
            d.lonMax,
            d.timeMin,
            d.timeMax,
            d.depthMin,
            d.depthMax,
            d.sensors,
            bm25(datasets_fts) as rank
          FROM datasets d
          JOIN datasets_fts ON d.datasetId = datasets_fts.rowid
          WHERE datasets_fts MATCH $ftsQuery
        `;
      } else {
        sql = `
          SELECT
            d.datasetId,
            d.shortName,
            d.longName,
            d.description,
            d.variableShortNames,
            d.variableLongNames,
            d.distributor,
            d.dataSource,
            d.keywords,
            d.processLevel,
            d.studyDomain,
            d.latMin,
            d.latMax,
            d.lonMin,
            d.lonMax,
            d.timeMin,
            d.timeMax,
            d.depthMin,
            d.depthMax,
            d.sensors
          FROM datasets d
          JOIN datasets_fts ON d.datasetId = datasets_fts.rowid
          WHERE datasets_fts MATCH $ftsQuery
        `;
      }
      params.ftsQuery = ftsQuery;
    } else {
      // No text search, just filters
      sql = `
        SELECT
          datasetId,
          shortName,
          longName,
          description,
          variableShortNames,
          variableLongNames,
          distributor,
          dataSource,
          keywords,
          processLevel,
          studyDomain,
          latMin,
          latMax,
          lonMin,
          lonMax,
          timeMin,
          timeMax,
          depthMin,
          depthMax,
          sensors
        FROM datasets
      `;
    }

    // Apply filters (use 'd' prefix for FTS joins)
    const filterConditions = this.buildFilterConditions(filters, params, ftsQuery ? 'd' : '');
    if (filterConditions.length > 0) {
      if (ftsQuery) {
        sql += ' AND ' + filterConditions.join(' AND ');
      } else {
        sql += ' WHERE ' + filterConditions.join(' AND ');
      }
    }

    // Add ordering
    if (ftsQuery && useRanking) {
      sql += ' ORDER BY rank';
    } else {
      const orderCol = ftsQuery ? 'd.datasetId' : 'datasetId';
      sql += ` ORDER BY ${orderCol}`;
    }

    // Execute query
    const stmt = this.db.prepare(sql);
    const results = stmt.all(params);

    return results;
  }

  /**
   * LIKE-based search matching backend exactly
   * @param {string} query - Search query text
   * @param {Object} filters - Spatial/temporal/depth filters
   * @param {Object} options - Search options
   * @returns {Array} Array of dataset results
   */
  searchLike(query, filters, options = {}) {
    const { excludeFields = [], phraseMatch = false } = options;

    // All searchable fields (matches what's available in SQLite and backend)
    // Backend searches: Variable_Long_Names, Variable_Short_Names, Dataset_Long_Name,
    // Sensors, Keywords, Distributor, Data_Source, Process_Level, Study_Domain
    const allFields = [
      'shortName',
      'longName',
      'description',
      'variableShortNames',
      'variableLongNames',
      'distributor',
      'dataSource',
      'keywords',
      'processLevel',
      'studyDomain',
      'sensors'
    ];

    // Filter out excluded fields
    const searchFields = allFields.filter(f => !excludeFields.includes(f));

    let sql = `
      SELECT
        datasetId,
        shortName,
        longName,
        description,
        variableShortNames,
        variableLongNames,
        distributor,
        dataSource,
        keywords,
        processLevel,
        studyDomain,
        latMin,
        latMax,
        lonMin,
        lonMax,
        timeMin,
        timeMax,
        depthMin,
        depthMax,
        sensors
      FROM datasets
    `;

    const params = {};
    const conditions = [];

    // Build LIKE conditions for text search
    if (query && query.trim()) {
      if (phraseMatch) {
        // Phrase matching: treat the entire query as a single phrase
        // This matches backend behavior where multi-word queries are NOT split
        const paramName = 'phrase';
        params[paramName] = `%${query.trim()}%`;

        // Build OR condition across all search fields for the phrase
        const fieldConditions = searchFields.map(field =>
          `${field} LIKE $${paramName}`
        );

        conditions.push(`(${fieldConditions.join(' OR ')})`);
      } else {
        // Original behavior: split query into keywords
        // Each keyword must match, but can match in different fields
        const keywords = query.trim().split(/\s+/);

        const keywordConditions = keywords.map((keyword, idx) => {
          const paramName = `keyword${idx}`;
          params[paramName] = `%${keyword}%`;

          // Build OR condition across all search fields for this keyword
          const fieldConditions = searchFields.map(field =>
            `${field} LIKE $${paramName}`
          );

          return `(${fieldConditions.join(' OR ')})`;
        });

        // All keywords must match (AND logic between keywords)
        conditions.push(`(${keywordConditions.join(' AND ')})`);
      }
    }

    // Apply spatial/temporal/depth filters
    const filterConditions = this.buildFilterConditions(filters, params);
    conditions.push(...filterConditions);

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // Order by datasetId
    sql += ' ORDER BY datasetId';

    // Execute query
    const stmt = this.db.prepare(sql);
    const results = stmt.all(params);

    return results;
  }

  /**
   * Build filter conditions for spatial/temporal/depth filters
   * @param {Object} filters - Filter object
   * @param {Object} params - Parameters object to populate
   * @param {string} tablePrefix - Optional table prefix (e.g., 'd.')
   * @returns {Array<string>} Array of SQL condition strings
   */
  buildFilterConditions(filters, params, tablePrefix = '') {
    const conditions = [];
    const prefix = tablePrefix ? `${tablePrefix}.` : '';

    // Spatial filters (with NULL handling - datasets with NULL coords should NOT match)
    if (filters.latMin !== undefined) {
      params.latMin = filters.latMin;
      conditions.push(`${prefix}latMin IS NOT NULL AND ${prefix}latMax IS NOT NULL AND ${prefix}latMax >= $latMin`);
    }
    if (filters.latMax !== undefined) {
      params.latMax = filters.latMax;
      conditions.push(`${prefix}latMin IS NOT NULL AND ${prefix}latMax IS NOT NULL AND ${prefix}latMin <= $latMax`);
    }
    if (filters.lonMin !== undefined) {
      params.lonMin = filters.lonMin;
      // Handle date line crossing
      if (filters.lonMax !== undefined && filters.lonMin > filters.lonMax) {
        // Date line crossing: (lonMax >= lonMin OR lonMin <= lonMax)
        params.lonMax = filters.lonMax;
        conditions.push(`${prefix}lonMin IS NOT NULL AND ${prefix}lonMax IS NOT NULL AND (${prefix}lonMax >= $lonMin OR ${prefix}lonMin <= $lonMax)`);
      } else {
        conditions.push(`${prefix}lonMin IS NOT NULL AND ${prefix}lonMax IS NOT NULL AND ${prefix}lonMax >= $lonMin`);
      }
    }
    if (filters.lonMax !== undefined && filters.lonMin === undefined) {
      params.lonMax = filters.lonMax;
      conditions.push(`${prefix}lonMin IS NOT NULL AND ${prefix}lonMax IS NOT NULL AND ${prefix}lonMin <= $lonMax`);
    }

    // Temporal filters (with NULL handling)
    if (filters.timeStart !== undefined) {
      params.timeStart = filters.timeStart;
      conditions.push(`${prefix}timeMin IS NOT NULL AND ${prefix}timeMax IS NOT NULL AND ${prefix}timeMax >= $timeStart`);
    }
    if (filters.timeEnd !== undefined) {
      params.timeEnd = filters.timeEnd;
      conditions.push(`${prefix}timeMin IS NOT NULL AND ${prefix}timeMax IS NOT NULL AND ${prefix}timeMin <= $timeEnd`);
    }

    // Depth filters
    if (filters.hasDepth === true) {
      conditions.push(`(${prefix}depthMin IS NOT NULL OR ${prefix}depthMax IS NOT NULL)`);
    } else if (filters.hasDepth === false) {
      conditions.push(`${prefix}depthMin IS NULL AND ${prefix}depthMax IS NULL`);
    }

    if (filters.depthMin !== undefined) {
      params.depthMin = filters.depthMin;
      conditions.push(`${prefix}depthMax IS NOT NULL AND ${prefix}depthMax >= $depthMin`);
    }
    if (filters.depthMax !== undefined) {
      params.depthMax = filters.depthMax;
      conditions.push(`${prefix}depthMin IS NOT NULL AND ${prefix}depthMin <= $depthMax`);
    }

    return conditions;
  }

  /**
   * Escape FTS query to prevent syntax errors
   * @param {string} query - Raw query string
   * @returns {string} Escaped query string
   */
  escapeFtsQuery(query) {
    // For FTS5, we need to handle special characters
    // Quote the entire query to treat it as a phrase with individual words OR'd
    // Split into words and wrap each in quotes for literal matching
    const words = query.trim().split(/\s+/);
    return words.map(word => {
      // Remove any existing quotes
      word = word.replace(/["']/g, '');
      // Escape any remaining special characters
      word = word.replace(/[(){}[\]:^-]/g, '\\$&');
      return `"${word}"`;
    }).join(' OR ');
  }

  /**
   * Get database statistics
   * @returns {Object} Database statistics
   */
  getStats() {
    const totalDatasets = this.db.prepare('SELECT COUNT(*) as count FROM datasets').get();
    const hasFts = this.db.prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='datasets_fts'"
    ).get();

    return {
      totalDatasets: totalDatasets.count,
      hasFtsTable: hasFts.count > 0
    };
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = SqliteSearchTester;
