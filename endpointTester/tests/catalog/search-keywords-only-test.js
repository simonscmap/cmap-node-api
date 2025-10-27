#!/usr/bin/env node

/**
 * Catalog Search Keywords-Only Parity Test
 * Tests SQLite keyword search strategies (no filters) against backend API
 * Goal: 100% exact matches - same results, no extra datasets, no missing datasets
 *
 * Usage:
 *   node endpointTester/tests/catalog/search-keywords-only-test.js
 *   node endpointTester/tests/catalog/search-keywords-only-test.js --rebuild
 *   node endpointTester/tests/catalog/search-keywords-only-test.js --query "CTD"
 *   node endpointTester/tests/catalog/search-keywords-only-test.js --strategies "LIKE-Backend-Match,FTS-No-Ranking"
 */

// Load environment variables from .env.local
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });

const CatalogDbLoader = require('../../lib/CatalogDbLoader');
const SqliteSearchTester = require('../../lib/SqliteSearchTester');
const ResultComparator = require('../../lib/ResultComparator');
const TestRunner = require('../../lib/TestRunner');
const { strategies } = require('../../config/searchStrategies');
const { queries } = require('../../fixtures/testQueries');
const chalk = require('chalk');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    rebuild: false,
    query: null,
    strategies: null,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rebuild') {
      options.rebuild = true;
    } else if (args[i] === '--query' && args[i + 1]) {
      options.query = args[i + 1];
      i++;
    } else if (args[i] === '--strategies' && args[i + 1]) {
      options.strategies = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

/**
 * Get backend search results
 */
async function getBackendResults(query) {
  const testRunner = new TestRunner();

  // Split text into keywords array to match production behavior
  // Production sends: ?keywords=sst&keywords=sat (array)
  // NOT: ?keywords=sst%20sat (single string with space)
  const keywords = query.text
    ? query.text.trim().split(/\s+/).filter(k => k.length > 0)
    : [];

  const queryParams = {
    keywords: keywords  // Send as array to match production
  };

  // Keywords-only tests should not have filters
  // but we still need to add them if they exist for consistency
  Object.assign(queryParams, query.filters);

  const result = await testRunner
    .get('/api/catalog/searchcatalog')
    .withQuery(queryParams)
    .skipValidation()
    .run();

  if (result.status !== 'PASS') {
    throw new Error(`Backend search failed: ${result.errors.join(', ')}`);
  }

  return result.response.body;
}

/**
 * Generate detailed query results table
 */
function generateQueryDetailsTable(results, strategiesToTest) {
  console.log(chalk.cyan('\n📋 Detailed Query Results Table\n'));
  console.log(chalk.gray('Comparing SQLite search strategies against backend API results'));
  console.log(chalk.gray('Each cell shows: dataset count, with issues like +N (extra) or -N (missing)\n'));

  // Create table header
  const queryTextWidth = 25;
  const backendColWidth = 10;
  const strategyColWidth = 20;

  let header = 'Search Query'.padEnd(queryTextWidth) + 'Backend'.padEnd(backendColWidth);
  strategiesToTest.forEach(strategy => {
    const shortName = strategy.name.replace('FTS-', '').replace('LIKE-', '').replace('-Match', '');
    header += shortName.substring(0, strategyColWidth - 1).padEnd(strategyColWidth);
  });
  console.log(chalk.white(header));
  console.log(chalk.gray('─'.repeat(queryTextWidth + backendColWidth + (strategyColWidth * strategiesToTest.length))));

  // Add each query row
  results.forEach(result => {
    const queryText = result.query.text.substring(0, queryTextWidth - 1);
    let row = queryText.padEnd(queryTextWidth);

    // Backend count
    row += result.backendCount.toString().padEnd(backendColWidth);

    // Strategy results
    result.strategyResults.forEach(sr => {
      const extra = sr.comparison.extra.length;
      const missing = sr.comparison.missing.length;
      const isPerfect = sr.comparison.matchPercentage === 100 && extra === 0 && missing === 0;

      let cellText = '';
      let cellTextLength = 0;

      if (isPerfect) {
        // Show checkmark for perfect matches, even if count is 0
        cellText = chalk.green('✅') + chalk.gray(` (${sr.sqliteCount})`);
        cellTextLength = 2 + 3 + sr.sqliteCount.toString().length; // emoji + " (" + count + ")"
      } else {
        const parts = [sr.sqliteCount.toString()];
        cellTextLength = parts[0].length;

        if (extra > 0) {
          parts.push(chalk.red(`+${extra}`));
          cellTextLength += 1 + extra.toString().length + 1; // space + sign + number + space
        }
        if (missing > 0) {
          parts.push(chalk.yellow(`-${missing}`));
          cellTextLength += 1 + missing.toString().length + 1;
        }
        cellText = parts.join(' ');
        cellTextLength += parts.length - 1; // spaces between parts
      }

      const padding = ' '.repeat(Math.max(0, strategyColWidth - cellTextLength));
      row += cellText + padding;
    });

    console.log(row);
  });

  console.log(chalk.gray('\nLegend: ✅ = Perfect match | +N = N extra datasets | -N = N missing datasets'));

  // Add pattern analysis
  console.log(chalk.cyan('\n🔍 Pattern Analysis for LIKE-Backend-Match:\n'));

  const likeStrategy = strategiesToTest.find(s => s.name === 'LIKE-Backend-Match');
  if (likeStrategy) {
    const perfect = [];
    const hasExtra = [];
    const hasMissing = [];
    const hasBoth = [];

    results.forEach(result => {
      const sr = result.strategyResults.find(r => r.strategyName === 'LIKE-Backend-Match');
      if (!sr) return;

      const extra = sr.comparison.extra.length;
      const missing = sr.comparison.missing.length;
      const query = result.query.text;

      if (extra === 0 && missing === 0) {
        perfect.push(query);
      } else if (extra > 0 && missing > 0) {
        hasBoth.push({ query, extra, missing });
      } else if (extra > 0) {
        hasExtra.push({ query, extra });
      } else if (missing > 0) {
        hasMissing.push({ query, missing });
      }
    });

    console.log(chalk.green(`  ✅ Perfect Matches (${perfect.length}): ${perfect.join(', ')}`));

    if (hasExtra.length > 0) {
      console.log(chalk.red(`\n  ⚠️  Has Extra Results Only (${hasExtra.length}):`));
      hasExtra.forEach(item => {
        console.log(chalk.red(`    "${item.query}": +${item.extra} extra`));
      });
    }

    if (hasMissing.length > 0) {
      console.log(chalk.yellow(`\n  ⚠️  Has Missing Results Only (${hasMissing.length}):`));
      hasMissing.forEach(item => {
        console.log(chalk.yellow(`    "${item.query}": -${item.missing} missing`));
      });
    }

    if (hasBoth.length > 0) {
      console.log(chalk.magenta(`\n  ⚠️  Has Both Extra and Missing (${hasBoth.length}):`));
      hasBoth.forEach(item => {
        console.log(chalk.magenta(`    "${item.query}": +${item.extra} extra, -${item.missing} missing`));
      });
    }
  }

  console.log('');
}

/**
 * Generate overall summary of strategy performance
 */
function generateSummary(results, strategiesToTest) {
  const strategyStats = {};

  strategiesToTest.forEach(strategy => {
    strategyStats[strategy.name] = {
      perfectMatches: 0,
      totalQueries: results.length,
      avgMatchPercentage: 0,
      totalMatchPercentage: 0,
      totalExtraDatasets: 0,
      totalMissingDatasets: 0
    };
  });

  results.forEach(result => {
    result.strategyResults.forEach(sr => {
      const stats = strategyStats[sr.strategyName];

      // Overall stats
      if (sr.comparison.matchPercentage === 100 &&
          sr.comparison.extra.length === 0 &&
          sr.comparison.missing.length === 0) {
        stats.perfectMatches++;
      }
      stats.totalMatchPercentage += sr.comparison.matchPercentage;
      stats.totalExtraDatasets += sr.comparison.extra.length;
      stats.totalMissingDatasets += sr.comparison.missing.length;
    });
  });

  // Calculate averages
  Object.values(strategyStats).forEach(stats => {
    stats.avgMatchPercentage = stats.totalMatchPercentage / stats.totalQueries;
  });

  // Sort by performance (perfect matches first, then avg percentage)
  const sortedStrategies = Object.entries(strategyStats)
    .sort((a, b) => {
      if (b[1].perfectMatches !== a[1].perfectMatches) {
        return b[1].perfectMatches - a[1].perfectMatches;
      }
      return b[1].avgMatchPercentage - a[1].avgMatchPercentage;
    });

  console.log(chalk.cyan('\nKeywords-Only Query Performance:'));
  console.log(chalk.gray('Goal: 100% exact matches - same results, no extra, no missing\n'));

  sortedStrategies.forEach(([name, stats]) => {
    const isPerfect = stats.perfectMatches === stats.totalQueries &&
                      stats.totalExtraDatasets === 0 &&
                      stats.totalMissingDatasets === 0;
    const color = isPerfect ? chalk.green :
                  stats.avgMatchPercentage >= 95 ? chalk.yellow : chalk.red;
    const icon = isPerfect ? ' ✅' : '';

    console.log(color(
      `  ${name.padEnd(25)}: ${stats.perfectMatches}/${stats.totalQueries} perfect matches ` +
      `(avg ${stats.avgMatchPercentage.toFixed(1)}%)${icon}`
    ));

    if (stats.totalExtraDatasets > 0 || stats.totalMissingDatasets > 0) {
      let issues = [];
      if (stats.totalExtraDatasets > 0) {
        issues.push(chalk.red(`${stats.totalExtraDatasets} extra`));
      }
      if (stats.totalMissingDatasets > 0) {
        issues.push(chalk.yellow(`${stats.totalMissingDatasets} missing`));
      }
      console.log(chalk.gray(`    └─ Issues: ${issues.join(', ')}`));
    }
  });

  // Recommendation
  const best = sortedStrategies[0];
  if (best[1].perfectMatches === best[1].totalQueries) {
    console.log(chalk.green.bold(`\n💡 Recommendation: Use "${best[0]}" for production (100% exact matches!)`));
  } else {
    console.log(chalk.yellow.bold(`\n⚠️  No strategy achieved 100% exact matches`));
    console.log(chalk.yellow(`   Best: "${best[0]}" with ${best[1].perfectMatches}/${best[1].totalQueries} perfect matches`));
  }

  return sortedStrategies;
}

/**
 * Main test execution
 */
async function runKeywordsOnlyTests(options = {}) {
  console.log(chalk.bold.cyan('\n🧪 Catalog Search Keywords-Only Parity Testing\n'));
  console.log(chalk.gray('Testing keyword searches WITHOUT spatial/temporal/depth filters\n'));

  // 1. Load database
  console.log(chalk.cyan('📥 Loading catalog database...'));
  const dbLoader = new CatalogDbLoader();
  const dbPath = await dbLoader.loadDatabase({ forceRebuild: options.rebuild });
  console.log(chalk.green(`   ✅ Database ready: ${dbPath}`));

  // 2. Initialize testers
  const sqliteTester = new SqliteSearchTester(dbPath);
  const comparator = new ResultComparator();

  // Show database stats
  const stats = sqliteTester.getStats();
  console.log(chalk.gray(`   Database contains ${stats.totalDatasets} datasets`));
  console.log(chalk.gray(`   FTS table available: ${stats.hasFtsTable ? 'Yes' : 'No'}`));

  // 3. Filter strategies if specified
  const strategiesToTest = options.strategies
    ? strategies.filter(s => options.strategies.includes(s.name))
    : strategies;

  console.log(chalk.cyan(`\nTesting ${strategiesToTest.length} search strategies against backend:`));
  strategiesToTest.forEach(s => console.log(chalk.gray(`  • ${s.name}: ${s.description}`)));

  // 4. Filter queries to only keywords-only queries
  let keywordsOnlyQueries = queries.filter(q => {
    // Only include queries with empty filters object and non-empty text
    return Object.keys(q.filters).length === 0 && q.text && q.text.trim() !== '';
  });

  // Add the required "sat sst" query
  keywordsOnlyQueries.push({
    name: 'Multi-word: sat sst',
    text: 'sat sst',
    filters: {}
  });

  // Apply user filter if specified
  if (options.query) {
    keywordsOnlyQueries = keywordsOnlyQueries.filter(q =>
      q.text.toLowerCase().includes(options.query.toLowerCase()) ||
      q.name.toLowerCase().includes(options.query.toLowerCase())
    );
    console.log(chalk.cyan(`\nFiltered to ${keywordsOnlyQueries.length} queries matching "${options.query}"`));
  }

  console.log(chalk.cyan(`\nTesting ${keywordsOnlyQueries.length} keywords-only queries (no spatial/temporal/depth filters)`));

  if (keywordsOnlyQueries.length === 0) {
    console.log(chalk.red('\n❌ No queries to test!'));
    sqliteTester.close();
    return;
  }

  // 5. Run tests
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < keywordsOnlyQueries.length; i++) {
    const query = keywordsOnlyQueries[i];

    console.log(chalk.blue(`\n${'━'.repeat(80)}`));
    console.log(chalk.blue.bold(`🔍 Query ${i + 1}/${keywordsOnlyQueries.length}: ${query.name}`));
    console.log(chalk.gray(`   Text: "${query.text}"`));

    // 5a. Get backend results
    let backendResults;
    try {
      backendResults = await getBackendResults(query);
      console.log(chalk.white(`\n   Backend Results: ${backendResults.length} datasets`));
    } catch (error) {
      console.log(chalk.red(`\n   ❌ Backend search failed: ${error.message}`));
      continue;
    }

    // 5b. Test each strategy
    const strategyResults = [];

    for (const strategy of strategiesToTest) {
      try {
        const sqliteResults = await sqliteTester.search(
          query.text,
          query.filters,
          strategy
        );

        const comparison = comparator.compare(backendResults, sqliteResults);

        strategyResults.push({
          strategyName: strategy.name,
          sqliteCount: sqliteResults.length,
          comparison: comparison
        });
      } catch (error) {
        console.log(chalk.red(`   ❌ Strategy "${strategy.name}" failed: ${error.message}`));
        strategyResults.push({
          strategyName: strategy.name,
          sqliteCount: 0,
          comparison: {
            matched: [],
            missing: [],
            extra: [],
            matchPercentage: 0,
            backendCount: backendResults.length,
            sqliteCount: 0
          },
          error: error.message
        });
      }
    }

    // 5c. Display strategy results
    console.log(chalk.white(`\n   Strategy Results:`));
    let bestMatch = [];
    let bestPercentage = 0;

    for (const result of strategyResults) {
      const { strategyName, sqliteCount, comparison, error } = result;

      if (error) {
        console.log(chalk.red(`     ${strategyName.padEnd(25)}: ERROR - ${error}`));
        continue;
      }

      const { matched, missing, extra, matchPercentage } = comparison;

      const isPerfect = matchPercentage === 100 && extra.length === 0 && missing.length === 0;
      const isGood = matchPercentage >= 95 && extra.length === 0;
      const color = isPerfect ? chalk.green : isGood ? chalk.yellow : chalk.red;
      const icon = isPerfect ? ' ✅' : '';

      // Highlight issues
      let issueWarning = '';
      if (extra.length > 0) {
        issueWarning = chalk.red(` ⚠️ ${extra.length} EXTRA`);
      }
      if (missing.length > 0) {
        issueWarning += chalk.yellow(` ⚠️ ${missing.length} MISSING`);
      }

      console.log(color(
        `     ${strategyName.padEnd(25)}: ${sqliteCount} datasets | ` +
        `${matched.length} matched (${matchPercentage.toFixed(1)}%)${icon}${issueWarning}`
      ));

      if (matchPercentage > bestPercentage) {
        bestPercentage = matchPercentage;
        bestMatch = [strategyName];
      } else if (matchPercentage === bestPercentage && bestMatch.length > 0) {
        bestMatch.push(strategyName);
      }
    }

    if (bestMatch.length > 0) {
      console.log(chalk.green(`\n   🏆 Best match: ${bestMatch.join(', ')} (${bestPercentage.toFixed(1)}%)`));
    }

    // Show discrepancies in verbose mode
    if (options.verbose && bestPercentage < 100) {
      const bestResult = strategyResults.find(r => r.strategyName === bestMatch[0]);
      if (bestResult && !bestResult.error) {
        const report = comparator.formatDiffReport(bestResult.comparison, { verbose: false });
        console.log(report);
      }
    }

    results.push({
      query: query,
      backendCount: backendResults.length,
      strategyResults: strategyResults
    });
  }

  const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // 6. Generate overall summary
  console.log(chalk.blue(`\n${'━'.repeat(80)}`));
  console.log(chalk.blue.bold('\n📊 Overall Summary'));
  console.log(chalk.gray(`   Tested ${keywordsOnlyQueries.length} keywords-only queries against ${strategiesToTest.length} strategies`));
  console.log(chalk.gray(`   Total execution time: ${executionTime}s`));

  generateQueryDetailsTable(results, strategiesToTest);
  generateSummary(results, strategiesToTest);

  // 7. Cleanup
  sqliteTester.close();
  console.log(chalk.gray('\n   Database connection closed\n'));

  return results;
}

// Run if executed directly
if (require.main === module) {
  const options = parseArgs();

  runKeywordsOnlyTests(options)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
      console.error(chalk.gray(error.stack));
      process.exit(1);
    });
}

module.exports = { runKeywordsOnlyTests };
