#!/usr/bin/env node

/**
 * Row Count Test - Verify rowCount column exists and is populated
 * Tests that the rowCount field appears in the catalog database
 *
 * Usage:
 *   node endpointTester/tests/catalog/row-count-test.js
 *   node endpointTester/tests/catalog/row-count-test.js --rebuild
 */

// Load environment variables from .env.local
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });

const Database = require('better-sqlite3');
const CatalogDbLoader = require('../../lib/CatalogDbLoader');
const chalk = require('chalk');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    rebuild: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rebuild') {
      options.rebuild = true;
    }
  }

  return options;
}

/**
 * Test that rowCount column exists
 */
function testRowCountColumnExists(db) {
  console.log(chalk.cyan('\n📋 Testing Schema for rowCount Column...'));

  const tableInfo = db.prepare('PRAGMA table_info(datasets)').all();
  const columnNames = tableInfo.map(col => col.name);

  if (columnNames.includes('rowCount')) {
    console.log(chalk.green('   ✅ Column "rowCount" exists'));
    return true;
  } else {
    console.log(chalk.red('   ❌ Column "rowCount" is missing'));
    console.log(chalk.gray('\n   Available columns:'));
    columnNames.forEach(name => {
      console.log(chalk.gray(`     - ${name}`));
    });
    return false;
  }
}

/**
 * Test that rowCount column contains data
 */
function testRowCountData(db) {
  console.log(chalk.cyan('\n📊 Testing rowCount Column Data...'));

  const totalCount = db.prepare('SELECT COUNT(*) as count FROM datasets').get().count;

  // Check for non-null values
  const nonNullCount = db.prepare("SELECT COUNT(*) as count FROM datasets WHERE rowCount IS NOT NULL").get().count;

  // Get some sample values
  const samples = db.prepare(`
    SELECT shortName, longName, rowCount
    FROM datasets
    WHERE rowCount IS NOT NULL
    ORDER BY rowCount DESC
    LIMIT 10
  `).all();

  console.log(chalk.white(`\n   Total datasets: ${totalCount}`));
  console.log(chalk.white(`   Datasets with rowCount: ${nonNullCount} (${((nonNullCount / totalCount) * 100).toFixed(1)}%)`));
  console.log(chalk.white(`   Datasets without rowCount: ${totalCount - nonNullCount}`));

  if (samples.length > 0) {
    console.log(chalk.white(`\n   Sample datasets with highest row counts:`));
    samples.forEach((sample, index) => {
      const rowCountFormatted = sample.rowCount ? sample.rowCount.toLocaleString() : 'null';
      console.log(chalk.gray(`     ${index + 1}. ${sample.shortName}: ${rowCountFormatted} rows`));
      console.log(chalk.gray(`        ${sample.longName}`));
    });
  }

  // Check if all values are null
  if (nonNullCount === 0) {
    console.log(chalk.red('\n   ❌ All rowCount values are NULL!'));
    return false;
  }

  // Get statistics
  const stats = db.prepare(`
    SELECT
      MIN(rowCount) as min,
      MAX(rowCount) as max,
      AVG(rowCount) as avg,
      COUNT(*) as count
    FROM datasets
    WHERE rowCount IS NOT NULL
  `).get();

  console.log(chalk.white(`\n   Row Count Statistics:`));
  console.log(chalk.gray(`     Min: ${stats.min ? stats.min.toLocaleString() : 'N/A'}`));
  console.log(chalk.gray(`     Max: ${stats.max ? stats.max.toLocaleString() : 'N/A'}`));
  console.log(chalk.gray(`     Avg: ${stats.avg ? Math.round(stats.avg).toLocaleString() : 'N/A'}`));

  return nonNullCount > 0;
}

/**
 * Test a specific dataset's rowCount
 */
function testSpecificDataset(db, shortName) {
  console.log(chalk.cyan(`\n🔍 Testing Specific Dataset: ${shortName}...`));

  const dataset = db.prepare(`
    SELECT shortName, longName, rowCount
    FROM datasets
    WHERE shortName = ?
  `).get(shortName);

  if (!dataset) {
    console.log(chalk.red(`   ❌ Dataset "${shortName}" not found`));
    return false;
  }

  console.log(chalk.white(`   Dataset: ${dataset.longName}`));
  console.log(chalk.white(`   Row Count: ${dataset.rowCount ? dataset.rowCount.toLocaleString() : 'NULL'}`));

  if (dataset.rowCount === null) {
    console.log(chalk.red('   ❌ Row count is NULL for this dataset'));
    return false;
  } else {
    console.log(chalk.green('   ✅ Row count is populated'));
    return true;
  }
}

/**
 * Main test execution
 */
async function runRowCountTest(options = {}) {
  console.log(chalk.bold.cyan('\n🧪 Row Count Column Test\n'));
  console.log(chalk.gray('Verifying that rowCount column is present and populated in the catalog database\n'));

  // 1. Load database
  console.log(chalk.cyan('📥 Loading catalog database...'));
  const dbLoader = new CatalogDbLoader();
  const dbPath = await dbLoader.loadDatabase({ forceRebuild: options.rebuild });
  console.log(chalk.green(`   ✅ Database ready: ${dbPath}`));

  // 2. Open database connection
  const db = new Database(dbPath, { readonly: true });

  try {
    // 3. Run tests
    const schemaTestPassed = testRowCountColumnExists(db);

    if (!schemaTestPassed) {
      console.log(chalk.red('\n❌ Schema test failed - column does not exist\n'));
      return;
    }

    const dataTestPassed = testRowCountData(db);

    // Test a few specific well-known datasets
    console.log(chalk.cyan('\n🎯 Testing Specific Datasets...'));

    // Get first few datasets to test
    const testDatasets = db.prepare(`
      SELECT shortName
      FROM datasets
      LIMIT 5
    `).all();

    testDatasets.forEach(dataset => {
      testSpecificDataset(db, dataset.shortName);
    });

    // 4. Summary
    console.log(chalk.blue(`\n${'━'.repeat(80)}`));
    console.log(chalk.blue.bold('\n📊 Test Summary\n'));

    if (schemaTestPassed && dataTestPassed) {
      console.log(chalk.green.bold('   ✅ ALL TESTS PASSED!\n'));
      console.log(chalk.green('   ✓ rowCount column exists'));
      console.log(chalk.green('   ✓ rowCount column contains data'));
    } else {
      console.log(chalk.red.bold('   ❌ TESTS FAILED\n'));
      if (!schemaTestPassed) {
        console.log(chalk.red('   ✗ rowCount column missing from schema'));
      }
      if (!dataTestPassed) {
        console.log(chalk.red('   ✗ rowCount column has no data'));
      }
    }

    console.log('');

  } finally {
    // 5. Cleanup
    db.close();
    console.log(chalk.gray('   Database connection closed\n'));
  }
}

// Run if executed directly
if (require.main === module) {
  const options = parseArgs();

  runRowCountTest(options)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
      console.error(chalk.gray(error.stack));
      process.exit(1);
    });
}

module.exports = { runRowCountTest };
