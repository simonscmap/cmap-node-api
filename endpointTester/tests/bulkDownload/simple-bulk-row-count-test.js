#!/usr/bin/env node

/**
 * Bulk Row Count Test - Migrated to Endpoint Tester V2 Framework
 *
 * Tests the /api/data/bulk-download-row-counts endpoint with three different
 * filter scenarios: initial, narrowed, and expanded.
 */

const TestRunner = require('../../lib/TestRunner');
const chalk = require('chalk');

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

// Test data
const shortNames = [
  'Gradients5_TN412_Hyperpro_Profiles',
  'Gradients5_TN412_FluorometricChlorophyll_UW',
  'Gradients5_TN412_FluorometricChlorophyll_CTD',
];

// Expected row counts
const expectedResults = {
  initial: {
    Gradients5_TN412_Hyperpro_Profiles: 34,
    Gradients5_TN412_FluorometricChlorophyll_UW: 17,
    Gradients5_TN412_FluorometricChlorophyll_CTD: 2,
  },
  narrowed: {
    Gradients5_TN412_Hyperpro_Profiles: 0,
    Gradients5_TN412_FluorometricChlorophyll_UW: 3,
    Gradients5_TN412_FluorometricChlorophyll_CTD: 0,
  },
  expanded: {
    Gradients5_TN412_Hyperpro_Profiles: 258,
    Gradients5_TN412_FluorometricChlorophyll_UW: 37,
    Gradients5_TN412_FluorometricChlorophyll_CTD: 15,
  }
};

// Filter configurations
const testFilters = {
  initial: {
    temporal: {
      startDate: '2023-01-26',
      endDate: '2023-01-31',
    },
    spatial: {
      latMin: 10,
      latMax: 40,
      lonMin: -140,
      lonMax: -120,
      depthMin: 0,
      depthMax: 20,
    },
  },
  narrowed: {
    temporal: {
      startDate: '2023-01-26',
      endDate: '2023-01-27',
    },
    spatial: {
      latMin: 10,
      latMax: 40,
      lonMin: -140,
      lonMax: -120,
      depthMin: 0,
      depthMax: 10,
    },
  },
  expanded: {
    temporal: {
      startDate: '2023-01-16',
      endDate: '2023-02-11',
    },
    spatial: {
      latMin: 0,
      latMax: 40,
      lonMin: -140,
      lonMax: -120,
      depthMin: 0,
      depthMax: 50,
    },
  }
};

/**
 * Create form data for the bulk row count request
 */
function createRequestBody(filters) {
  const formData = new URLSearchParams();
  formData.append('shortNames', JSON.stringify(shortNames));
  formData.append('filters', JSON.stringify(filters));
  return formData.toString();
}

/**
 * Validate the test results against expected values
 */
function validateResults(actual, expected, testName) {
  const results = {
    testName: testName,
    passed: true,
    details: [],
    summary: { actual: 0, expected: 0 }
  };

  // Check each dataset
  for (const dataset of shortNames) {
    const actualCount = actual[dataset] || 0;
    const expectedCount = expected[dataset] || 0;
    const match = actualCount === expectedCount;

    results.details.push({
      dataset: dataset,
      actual: actualCount,
      expected: expectedCount,
      passed: match
    });

    if (!match) {
      results.passed = false;
    }
  }

  // Calculate totals
  results.summary.actual = Object.values(actual).reduce((sum, count) => sum + count, 0);
  results.summary.expected = Object.values(expected).reduce((sum, count) => sum + count, 0);

  if (results.summary.actual !== results.summary.expected) {
    results.passed = false;
  }

  return results;
}

/**
 * Display test results with colored output
 */
function displayResults(validationResult) {
  const icon = validationResult.passed ? '✅' : '❌';
  const color = validationResult.passed ? chalk.green : chalk.red;

  console.log(`\n📋 ${validationResult.testName}`);

  validationResult.details.forEach(detail => {
    const resultIcon = detail.passed ? '✅' : '❌';
    console.log(`   ${detail.dataset}: ${detail.actual} ${resultIcon}`);
    if (!detail.passed) {
      console.log(chalk.red(`      Expected: ${detail.expected}, Got: ${detail.actual}`));
    }
  });

  const totalIcon = validationResult.summary.actual === validationResult.summary.expected ? '✅' : '❌';
  console.log(`   Total: ${validationResult.summary.actual} ${totalIcon}`);

  return validationResult.passed;
}

/**
 * Run a single bulk row count test
 */
async function runBulkRowCountTest(filterName, filters, expected) {
  try {
    const requestBody = createRequestBody(filters);

    const result = await TestRunner
      .create(BASE_URL)
      .post('/api/data/bulk-download-row-counts')
      .withHeaders({
        'Content-Type': 'application/x-www-form-urlencoded'
      })
      .withBody(requestBody)
      .withAuth() // Auto-detect authentication
      .withTimeout(15000) // Longer timeout for bulk operations
      .expectStatus(200)
      .run();

    if (result.status === 'PASS') {
      const validationResult = validateResults(result.response.body, expected, `${filterName} Filters`);
      return displayResults(validationResult);
    } else {
      console.log(chalk.red(`❌ Test failed: ${filterName}`));
      console.log(chalk.red(`   Errors: ${result.errors.join(', ')}`));
      console.log(chalk.gray(`   Execution time: ${result.executionTime}ms`));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Test error for ${filterName}: ${error.message}`));
    return false;
  }
}

/**
 * Main test execution
 */
async function runBulkRowCountTests() {
  console.log(chalk.cyan('🧪 Testing Bulk Row Count Endpoint - Framework V2'));

  const testResults = [];

  // Run tests sequentially
  for (const [filterName, filters] of Object.entries(testFilters)) {
    const expected = expectedResults[filterName];
    const passed = await runBulkRowCountTest(filterName, filters, expected);
    testResults.push({ filterName, passed });
  }

  // Summary
  const allPassed = testResults.every(result => result.passed);
  const passedCount = testResults.filter(result => result.passed).length;
  const totalCount = testResults.length;

  console.log(chalk.cyan('\n🏁 Test Summary'));
  testResults.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? chalk.green : chalk.red;
    console.log(color(`   ${icon} ${result.filterName} filters`));
  });

  const summaryColor = allPassed ? chalk.green : chalk.red;
  const summaryIcon = allPassed ? '✅' : '❌';

  console.log(summaryColor(`\n${summaryIcon} Overall: ${passedCount}/${totalCount} tests passed`));

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runBulkRowCountTests().catch(error => {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    process.exit(1);
  });
}

module.exports = {
  runBulkRowCountTests,
  runBulkRowCountTest,
  testFilters,
  expectedResults,
  shortNames
};