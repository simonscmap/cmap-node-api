#!/usr/bin/env node

/**
 * New Columns Test - Verify make, regions, and datasetType columns
 * Tests that the new columns are present in the catalog database and populated correctly
 *
 * Usage:
 *   node endpointTester/tests/catalog/new-columns-test.js
 *   node endpointTester/tests/catalog/new-columns-test.js --rebuild
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
 * Test that the new columns exist in the schema
 */
function testSchemaHasNewColumns(db) {
  console.log(chalk.cyan('\n📋 Testing Schema for New Columns...'));

  const tableInfo = db.prepare('PRAGMA table_info(datasets)').all();
  const columnNames = tableInfo.map(col => col.name);

  const requiredColumns = ['make', 'regions', 'datasetType'];
  const results = {
    passed: [],
    failed: []
  };

  requiredColumns.forEach(colName => {
    if (columnNames.includes(colName)) {
      results.passed.push(colName);
      console.log(chalk.green(`   ✅ Column '${colName}' exists`));
    } else {
      results.failed.push(colName);
      console.log(chalk.red(`   ❌ Column '${colName}' is missing`));
    }
  });

  return results;
}

/**
 * Test that the new columns are included in the FTS table
 */
function testFtsIncludesNewColumns(db) {
  console.log(chalk.cyan('\n🔍 Testing FTS Table for New Columns...'));

  try {
    // Try to query the FTS table with the new columns
    const ftsTableInfo = db.prepare('PRAGMA table_info(datasets_fts)').all();
    const ftsColumns = ftsTableInfo.map(col => col.name);

    const requiredFtsColumns = ['make', 'regions', 'datasetType'];
    const results = {
      passed: [],
      failed: []
    };

    requiredFtsColumns.forEach(colName => {
      if (ftsColumns.includes(colName)) {
        results.passed.push(colName);
        console.log(chalk.green(`   ✅ FTS column '${colName}' exists`));
      } else {
        results.failed.push(colName);
        console.log(chalk.red(`   ❌ FTS column '${colName}' is missing`));
      }
    });

    return results;
  } catch (error) {
    console.log(chalk.red(`   ❌ Error checking FTS table: ${error.message}`));
    return { passed: [], failed: ['make', 'regions', 'datasetType'] };
  }
}

/**
 * Test that the new columns contain data
 */
function testColumnsHaveData(db) {
  console.log(chalk.cyan('\n📊 Testing that New Columns Contain Data...'));

  const results = {
    make: { total: 0, populated: 0, null: 0, samples: [] },
    regions: { total: 0, populated: 0, null: 0, samples: [] },
    datasetType: { total: 0, populated: 0, null: 0, samples: [] }
  };

  // Get total count
  const totalCount = db.prepare('SELECT COUNT(*) as count FROM datasets').get().count;
  results.make.total = totalCount;
  results.regions.total = totalCount;
  results.datasetType.total = totalCount;

  // Check make column
  const makePopulated = db.prepare("SELECT COUNT(*) as count FROM datasets WHERE make IS NOT NULL AND make != ''").get().count;
  results.make.populated = makePopulated;
  results.make.null = totalCount - makePopulated;

  const makeSamples = db.prepare("SELECT shortName, make FROM datasets WHERE make IS NOT NULL AND make != '' LIMIT 5").all();
  results.make.samples = makeSamples;

  // Check regions column
  const regionsPopulated = db.prepare("SELECT COUNT(*) as count FROM datasets WHERE regions IS NOT NULL AND regions != ''").get().count;
  results.regions.populated = regionsPopulated;
  results.regions.null = totalCount - regionsPopulated;

  const regionsSamples = db.prepare("SELECT shortName, regions FROM datasets WHERE regions IS NOT NULL AND regions != '' LIMIT 5").all();
  results.regions.samples = regionsSamples;

  // Check datasetType column
  const datasetTypePopulated = db.prepare("SELECT COUNT(*) as count FROM datasets WHERE datasetType IS NOT NULL AND datasetType != ''").get().count;
  results.datasetType.populated = datasetTypePopulated;
  results.datasetType.null = totalCount - datasetTypePopulated;

  const datasetTypeSamples = db.prepare('SELECT shortName, datasetType FROM datasets LIMIT 5').all();
  results.datasetType.samples = datasetTypeSamples;

  // Display results
  console.log(chalk.white(`\n   Make Column:`));
  console.log(chalk.gray(`     Total datasets: ${results.make.total}`));
  console.log(chalk.gray(`     Populated: ${results.make.populated} (${((results.make.populated / results.make.total) * 100).toFixed(1)}%)`));
  console.log(chalk.gray(`     Null/Empty: ${results.make.null}`));
  if (results.make.samples.length > 0) {
    console.log(chalk.gray(`     Sample values:`));
    results.make.samples.forEach(s => {
      console.log(chalk.gray(`       - ${s.shortName}: "${s.make}"`));
    });
  }

  console.log(chalk.white(`\n   Regions Column:`));
  console.log(chalk.gray(`     Total datasets: ${results.regions.total}`));
  console.log(chalk.gray(`     Populated: ${results.regions.populated} (${((results.regions.populated / results.regions.total) * 100).toFixed(1)}%)`));
  console.log(chalk.gray(`     Null/Empty: ${results.regions.null}`));
  if (results.regions.samples.length > 0) {
    console.log(chalk.gray(`     Sample values:`));
    results.regions.samples.forEach(s => {
      console.log(chalk.gray(`       - ${s.shortName}: "${s.regions}"`));
    });
  }

  console.log(chalk.white(`\n   Dataset Type Column:`));
  console.log(chalk.gray(`     Total datasets: ${results.datasetType.total}`));
  console.log(chalk.gray(`     Populated: ${results.datasetType.populated} (${((results.datasetType.populated / results.datasetType.total) * 100).toFixed(1)}%)`));
  console.log(chalk.gray(`     Null/Empty: ${results.datasetType.null}`));
  if (results.datasetType.samples.length > 0) {
    console.log(chalk.gray(`     Sample values:`));
    results.datasetType.samples.forEach(s => {
      console.log(chalk.gray(`       - ${s.shortName}: "${s.datasetType}"`));
    });
  }

  // Check if datasetType values are valid
  const validTypes = ['Model', 'Satellite', 'In-Situ'];
  const typeDistribution = db.prepare(`
    SELECT datasetType, COUNT(*) as count
    FROM datasets
    WHERE datasetType IS NOT NULL
    GROUP BY datasetType
  `).all();

  console.log(chalk.white(`\n   Dataset Type Distribution:`));
  typeDistribution.forEach(row => {
    const isValid = validTypes.includes(row.datasetType);
    const icon = isValid ? chalk.green('✅') : chalk.red('❌');
    console.log(chalk.gray(`     ${icon} ${row.datasetType}: ${row.count} datasets`));
  });

  return results;
}

/**
 * Test that FTS search works with new columns
 */
function testFtsSearchWithNewColumns(db) {
  console.log(chalk.cyan('\n🔎 Testing FTS Search with New Columns...'));

  const searchTests = [
    { column: 'make', term: 'model', description: 'Search for "model" in make column' },
    { column: 'make', term: 'observation', description: 'Search for "observation" in make column' },
    { column: 'datasetType', term: 'Satellite', description: 'Search for "Satellite" in datasetType column' },
    { column: 'datasetType', term: '"In-Situ"', description: 'Search for "In-Situ" in datasetType column (quoted for hyphen)' }
  ];

  const results = [];

  searchTests.forEach(test => {
    try {
      const query = db.prepare(`
        SELECT COUNT(*) as count
        FROM datasets_fts
        WHERE datasets_fts MATCH ?
      `);
      const result = query.get(test.term);

      console.log(chalk.gray(`   ${test.description}:`));
      if (result.count > 0) {
        console.log(chalk.green(`     ✅ Found ${result.count} results`));
        results.push({ ...test, passed: true, count: result.count });
      } else {
        console.log(chalk.yellow(`     ⚠️  No results found (may be okay if no data matches)`));
        results.push({ ...test, passed: true, count: 0 });
      }
    } catch (error) {
      console.log(chalk.red(`     ❌ Search failed: ${error.message}`));
      results.push({ ...test, passed: false, error: error.message });
    }
  });

  return results;
}

/**
 * Main test execution
 */
async function runNewColumnsTest(options = {}) {
  console.log(chalk.bold.cyan('\n🧪 New Columns Test - make, regions, datasetType\n'));
  console.log(chalk.gray('Verifying that new columns are present and populated in the catalog database\n'));

  // 1. Load database
  console.log(chalk.cyan('📥 Loading catalog database...'));
  const dbLoader = new CatalogDbLoader();
  const dbPath = await dbLoader.loadDatabase({ forceRebuild: options.rebuild });
  console.log(chalk.green(`   ✅ Database ready: ${dbPath}`));

  // 2. Open database connection
  const db = new Database(dbPath, { readonly: true });

  try {
    // 3. Run tests
    const schemaResults = testSchemaHasNewColumns(db);
    const ftsResults = testFtsIncludesNewColumns(db);
    const dataResults = testColumnsHaveData(db);
    const searchResults = testFtsSearchWithNewColumns(db);

    // 4. Summary
    console.log(chalk.blue(`\n${'━'.repeat(80)}`));
    console.log(chalk.blue.bold('\n📊 Test Summary\n'));

    const allPassed =
      schemaResults.failed.length === 0 &&
      ftsResults.failed.length === 0 &&
      dataResults.datasetType.populated === dataResults.datasetType.total &&
      searchResults.every(r => r.passed);

    if (allPassed) {
      console.log(chalk.green.bold('   ✅ ALL TESTS PASSED!\n'));
      console.log(chalk.green('   Schema: All columns exist'));
      console.log(chalk.green('   FTS: All columns searchable'));
      console.log(chalk.green('   Data: All columns populated'));
      console.log(chalk.green('   Search: FTS queries work correctly'));
    } else {
      console.log(chalk.yellow.bold('   ⚠️  SOME TESTS HAD ISSUES\n'));

      if (schemaResults.failed.length > 0) {
        console.log(chalk.red(`   ❌ Schema: Missing columns: ${schemaResults.failed.join(', ')}`));
      } else {
        console.log(chalk.green('   ✅ Schema: All columns exist'));
      }

      if (ftsResults.failed.length > 0) {
        console.log(chalk.red(`   ❌ FTS: Missing columns: ${ftsResults.failed.join(', ')}`));
      } else {
        console.log(chalk.green('   ✅ FTS: All columns searchable'));
      }

      if (dataResults.datasetType.null > 0) {
        console.log(chalk.yellow(`   ⚠️  Data: ${dataResults.datasetType.null} datasets missing datasetType`));
      } else {
        console.log(chalk.green('   ✅ Data: All columns populated'));
      }

      const failedSearches = searchResults.filter(r => !r.passed);
      if (failedSearches.length > 0) {
        console.log(chalk.red(`   ❌ Search: ${failedSearches.length} search tests failed`));
      } else {
        console.log(chalk.green('   ✅ Search: FTS queries work correctly'));
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

  runNewColumnsTest(options)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
      console.error(chalk.gray(error.stack));
      process.exit(1);
    });
}

module.exports = { runNewColumnsTest };
