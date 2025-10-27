#!/usr/bin/env node

/**
 * Catalog Search Parity Test
 * Tests multiple SQLite search strategies against backend API to find optimal implementation
 *
 * Usage:
 *   node endpointTester/tests/catalog/search-parity-test.js
 *   node endpointTester/tests/catalog/search-parity-test.js --rebuild
 *   node endpointTester/tests/catalog/search-parity-test.js --query "CTD"
 *   node endpointTester/tests/catalog/search-parity-test.js --strategies "LIKE-Backend-Match,FTS-All-Fields"
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

  // Add filters
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
      // Keywords-only vs filtered breakdown
      keywordsOnly: {
        count: 0,
        totalMatchPercentage: 0,
        avgMatchPercentage: 0
      },
      withFilters: {
        count: 0,
        totalMatchPercentage: 0,
        avgMatchPercentage: 0
      }
    };
  });

  results.forEach(result => {
    const hasFilters = Object.keys(result.query.filters).length > 0;

    result.strategyResults.forEach(sr => {
      const stats = strategyStats[sr.strategyName];

      // Overall stats
      if (sr.comparison.matchPercentage === 100) {
        stats.perfectMatches++;
      }
      stats.totalMatchPercentage += sr.comparison.matchPercentage;

      // Breakdown by query type
      if (hasFilters) {
        stats.withFilters.count++;
        stats.withFilters.totalMatchPercentage += sr.comparison.matchPercentage;
      } else {
        stats.keywordsOnly.count++;
        stats.keywordsOnly.totalMatchPercentage += sr.comparison.matchPercentage;
      }
    });
  });

  // Calculate averages
  Object.values(strategyStats).forEach(stats => {
    stats.avgMatchPercentage = stats.totalMatchPercentage / stats.totalQueries;

    if (stats.keywordsOnly.count > 0) {
      stats.keywordsOnly.avgMatchPercentage =
        stats.keywordsOnly.totalMatchPercentage / stats.keywordsOnly.count;
    }

    if (stats.withFilters.count > 0) {
      stats.withFilters.avgMatchPercentage =
        stats.withFilters.totalMatchPercentage / stats.withFilters.count;
    }
  });

  // Sort by performance (perfect matches first, then avg percentage)
  const sortedStrategies = Object.entries(strategyStats)
    .sort((a, b) => {
      if (b[1].perfectMatches !== a[1].perfectMatches) {
        return b[1].perfectMatches - a[1].perfectMatches;
      }
      return b[1].avgMatchPercentage - a[1].avgMatchPercentage;
    });

  console.log(chalk.cyan('\nOverall Strategy Performance:'));
  sortedStrategies.forEach(([name, stats]) => {
    const color = stats.perfectMatches === stats.totalQueries ? chalk.green : chalk.yellow;
    console.log(color(
      `  ${name.padEnd(25)}: ${stats.perfectMatches}/${stats.totalQueries} perfect matches ` +
      `(avg ${stats.avgMatchPercentage.toFixed(1)}%)`
    ));
  });

  // Breakdown by query type
  console.log(chalk.cyan('\nBreakdown by Query Type:'));
  console.log(chalk.gray('  (Goal: 100% exact matches - same results, no extra, no missing)\n'));

  sortedStrategies.forEach(([name, stats]) => {
    console.log(chalk.white(`  ${name}:`));

    if (stats.keywordsOnly.count > 0) {
      const isPerfect = stats.keywordsOnly.avgMatchPercentage === 100;
      const color = isPerfect ? chalk.green :
                    stats.keywordsOnly.avgMatchPercentage >= 95 ? chalk.yellow : chalk.red;
      const icon = isPerfect ? ' ✅' : '';
      console.log(color(
        `    Keywords-only queries: ${stats.keywordsOnly.avgMatchPercentage.toFixed(1)}% avg match ` +
        `(${stats.keywordsOnly.count} queries)${icon}`
      ));
    }

    if (stats.withFilters.count > 0) {
      const isPerfect = stats.withFilters.avgMatchPercentage === 100;
      const color = isPerfect ? chalk.green :
                    stats.withFilters.avgMatchPercentage >= 95 ? chalk.yellow : chalk.red;
      const icon = isPerfect ? ' ✅' : ' ⚠️';
      console.log(color(
        `    With filters:          ${stats.withFilters.avgMatchPercentage.toFixed(1)}% avg match ` +
        `(${stats.withFilters.count} queries)${icon}`
      ));
    }
  });

  // Recommendation
  const best = sortedStrategies[0];
  console.log(chalk.green.bold(`\n💡 Recommendation: Use "${best[0]}" for production`));

  return sortedStrategies;
}

/**
 * Main test execution
 */
async function runParityTests(options = {}) {
  console.log(chalk.bold.cyan('\n🧪 Catalog Search Parity Testing\n'));

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

  // 4. Filter queries if specified
  let queriesToTest = queries;
  if (options.query) {
    queriesToTest = queries.filter(q =>
      q.text.toLowerCase().includes(options.query.toLowerCase()) ||
      q.name.toLowerCase().includes(options.query.toLowerCase())
    );
    console.log(chalk.cyan(`\nFiltered to ${queriesToTest.length} queries matching "${options.query}"`));
  }

  if (queriesToTest.length === 0) {
    console.log(chalk.red('\n❌ No queries to test!'));
    sqliteTester.close();
    return;
  }

  // 5. Run tests
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < queriesToTest.length; i++) {
    const query = queriesToTest[i];

    console.log(chalk.blue(`\n${'━'.repeat(80)}`));
    console.log(chalk.blue.bold(`🔍 Query ${i + 1}/${queriesToTest.length}: ${query.name}`));
    console.log(chalk.gray(`   Text: "${query.text || '(empty)'}"`));
    if (Object.keys(query.filters).length > 0) {
      console.log(chalk.gray(`   Filters: ${JSON.stringify(query.filters)}`));
    }

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
  console.log(chalk.gray(`   Tested ${queriesToTest.length} queries against ${strategiesToTest.length} strategies`));
  console.log(chalk.gray(`   Total execution time: ${executionTime}s`));

  generateSummary(results, strategiesToTest);

  // 7. Cleanup
  sqliteTester.close();
  console.log(chalk.gray('\n   Database connection closed\n'));

  return results;
}

// Run if executed directly
if (require.main === module) {
  const options = parseArgs();

  runParityTests(options)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
      console.error(chalk.gray(error.stack));
      process.exit(1);
    });
}

module.exports = { runParityTests };
