/**
 * ResultComparator - Compare two result sets and generate detailed diff
 * Compares backend vs SQLite search results to identify matches, misses, and extras
 */

const chalk = require('chalk');

class ResultComparator {
  /**
   * Compare two result sets
   * @param {Array} backendResults - Results from backend API
   * @param {Array} sqliteResults - Results from SQLite search
   * @returns {Object} Comparison results
   */
  compare(backendResults, sqliteResults) {
    const backendIdentifiers = this.extractIdentifiers(backendResults);
    const sqliteIdentifiers = this.extractIdentifiers(sqliteResults);

    return this.generateDiff(backendIdentifiers, sqliteIdentifiers);
  }

  /**
   * Extract dataset identifiers from results
   * @param {Array} results - Array of dataset objects
   * @returns {Map} Map of datasetId -> dataset object
   */
  extractIdentifiers(results) {
    const identifiers = new Map();

    results.forEach(dataset => {
      // Primary identifier: datasetId (try all variations)
      const id = dataset.datasetId || dataset.dataset_id || dataset.Dataset_ID;
      const shortName = dataset.shortName || dataset.short_name || dataset.Short_Name;

      if (id) {
        identifiers.set(id, {
          datasetId: id,
          shortName: shortName,
          dataset: dataset
        });
      }
    });

    return identifiers;
  }

  /**
   * Generate diff between two identifier sets
   * @param {Map} backendIds - Backend dataset identifiers
   * @param {Map} sqliteIds - SQLite dataset identifiers
   * @returns {Object} Diff object
   */
  generateDiff(backendIds, sqliteIds) {
    const matched = [];
    const missing = []; // In backend but not in SQLite
    const extra = [];   // In SQLite but not in backend

    // Find matched and missing datasets
    backendIds.forEach((value, datasetId) => {
      if (sqliteIds.has(datasetId)) {
        matched.push({
          datasetId: datasetId,
          shortName: value.shortName
        });
      } else {
        missing.push({
          datasetId: datasetId,
          shortName: value.shortName
        });
      }
    });

    // Find extra datasets (in SQLite but not backend)
    sqliteIds.forEach((value, datasetId) => {
      if (!backendIds.has(datasetId)) {
        extra.push({
          datasetId: datasetId,
          shortName: value.shortName
        });
      }
    });

    // Calculate match percentage
    const totalBackend = backendIds.size;
    const totalSqlite = sqliteIds.size;

    // Special case: both empty is a perfect match (100%)
    // Otherwise: percentage of backend results that were matched
    const matchPercentage = totalBackend === 0 && totalSqlite === 0
      ? 100
      : totalBackend > 0
        ? (matched.length / totalBackend) * 100
        : 0;

    return {
      matched: matched,
      missing: missing,
      extra: extra,
      matchPercentage: matchPercentage,
      backendCount: totalBackend,
      sqliteCount: sqliteIds.size,
      matchedCount: matched.length,
      missingCount: missing.length,
      extraCount: extra.length
    };
  }

  /**
   * Format diff as human-readable report
   * @param {Object} diff - Diff object from generateDiff
   * @param {Object} options - Formatting options
   * @returns {string} Formatted report
   */
  formatDiffReport(diff, options = {}) {
    const { verbose = false, showMatched = false } = options;

    const lines = [];

    // Summary
    lines.push(chalk.bold('\n=== Comparison Summary ==='));
    lines.push(`Backend Results: ${diff.backendCount} datasets`);
    lines.push(`SQLite Results:  ${diff.sqliteCount} datasets`);
    lines.push(`Matched:         ${diff.matchedCount} datasets (${diff.matchPercentage.toFixed(1)}%)`);

    if (diff.matchPercentage === 100) {
      lines.push(chalk.green.bold('✅ Perfect match!'));
    } else {
      lines.push(chalk.yellow(`Missing:         ${diff.missingCount} datasets (in backend but not SQLite)`));
      lines.push(chalk.yellow(`Extra:           ${diff.extraCount} datasets (in SQLite but not backend)`));
    }

    // Show matched datasets if requested
    if (showMatched && diff.matched.length > 0) {
      lines.push(chalk.green('\n--- Matched Datasets ---'));
      diff.matched.forEach(item => {
        lines.push(chalk.green(`  ✓ ${item.datasetId} (${item.shortName || 'no short name'})`));
      });
    }

    // Show missing datasets
    if (diff.missing.length > 0) {
      lines.push(chalk.red('\n--- Missing Datasets (in backend but not SQLite) ---'));
      diff.missing.slice(0, verbose ? undefined : 10).forEach(item => {
        lines.push(chalk.red(`  ✗ ${item.datasetId} (${item.shortName || 'no short name'})`));
      });
      if (!verbose && diff.missing.length > 10) {
        lines.push(chalk.gray(`  ... and ${diff.missing.length - 10} more`));
      }
    }

    // Show extra datasets
    if (diff.extra.length > 0) {
      lines.push(chalk.yellow('\n--- Extra Datasets (in SQLite but not backend) ---'));
      diff.extra.slice(0, verbose ? undefined : 10).forEach(item => {
        lines.push(chalk.yellow(`  + ${item.datasetId} (${item.shortName || 'no short name'})`));
      });
      if (!verbose && diff.extra.length > 10) {
        lines.push(chalk.gray(`  ... and ${diff.extra.length - 10} more`));
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate compact summary line for a comparison
   * @param {Object} diff - Diff object
   * @returns {string} Compact summary
   */
  formatCompactSummary(diff) {
    const isPerfect = diff.matchPercentage === 100;
    const color = isPerfect ? chalk.green : chalk.yellow;
    const icon = isPerfect ? '✅' : '⚠️';

    return color(
      `${icon} ${diff.matchedCount}/${diff.backendCount} matched (${diff.matchPercentage.toFixed(1)}%) | ` +
      `+${diff.extraCount} extra, -${diff.missingCount} missing`
    );
  }

  /**
   * Compare field values between two datasets
   * @param {Object} dataset1 - First dataset
   * @param {Object} dataset2 - Second dataset
   * @param {Array<string>} fields - Fields to compare
   * @returns {Object} Field comparison results
   */
  compareFields(dataset1, dataset2, fields) {
    const differences = [];
    const matches = [];

    fields.forEach(field => {
      const value1 = dataset1[field];
      const value2 = dataset2[field];

      if (value1 === value2) {
        matches.push(field);
      } else {
        differences.push({
          field: field,
          backendValue: value1,
          sqliteValue: value2
        });
      }
    });

    return {
      matches: matches,
      differences: differences,
      matchPercentage: (matches.length / fields.length) * 100
    };
  }

  /**
   * Analyze why datasets might be missing or extra
   * @param {Array} backendResults - Backend results
   * @param {Array} sqliteResults - SQLite results
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @returns {Object} Analysis results
   */
  analyzeDiscrepancies(backendResults, sqliteResults, query, filters) {
    const backendIds = this.extractIdentifiers(backendResults);
    const sqliteIds = this.extractIdentifiers(sqliteResults);
    const diff = this.generateDiff(backendIds, sqliteIds);

    const analysis = {
      query: query,
      filters: filters,
      summary: diff,
      possibleCauses: []
    };

    // Analyze missing datasets
    if (diff.missing.length > 0) {
      analysis.possibleCauses.push({
        type: 'missing',
        count: diff.missing.length,
        likelyCauses: [
          'SQLite search logic is more restrictive than backend',
          'Different tokenization or text matching behavior',
          'Field exclusion removing relevant results',
          'Filter logic differences (especially for NULL handling)'
        ],
        affectedDatasets: diff.missing.slice(0, 5)
      });
    }

    // Analyze extra datasets
    if (diff.extra.length > 0) {
      analysis.possibleCauses.push({
        type: 'extra',
        count: diff.extra.length,
        likelyCauses: [
          'SQLite search logic is more permissive than backend',
          'FTS ranking including less relevant results',
          'Different handling of special characters or punctuation',
          'Filter logic differences'
        ],
        affectedDatasets: diff.extra.slice(0, 5)
      });
    }

    return analysis;
  }
}

module.exports = ResultComparator;
