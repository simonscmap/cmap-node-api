require('dotenv').config();
const { setTimeout } = require('timers');
const { generateTestFiles } = require('./test-data-generator');
const {
  createMockRequest,
  createMockResponse,
} = require('./mock-http-context');
const {
  overrideBatchConfig,
  generateAllCombinations,
} = require('./config-override');
// const testConfig = require('./test-configurations.json');
const testConfig = require('./test-configurations-tester.json');
// const testConfig = require('./test-configuration-base-case.json');

const validateConfiguration = (testParams) => {
  const warnings = [];

  // Validate REPEAT_COUNT
  if (
    typeof testParams.REPEAT_COUNT !== 'number' &&
    !Array.isArray(testParams.REPEAT_COUNT)
  ) {
    warnings.push('REPEAT_COUNT should be a number or array');
  }

  if (
    typeof testParams.REPEAT_COUNT === 'number' &&
    testParams.REPEAT_COUNT <= 0
  ) {
    warnings.push('REPEAT_COUNT should be greater than 0');
  }

  // Validate BATCH_SIZE
  const batchSizes = Array.isArray(testParams.BATCH_SIZE)
    ? testParams.BATCH_SIZE
    : [testParams.BATCH_SIZE];
  batchSizes.forEach((size) => {
    if (
      size !== -1 &&
      size !== 'infinity' &&
      (typeof size !== 'number' || size <= 0)
    ) {
      warnings.push(
        `Invalid BATCH_SIZE value: ${size}. Should be -1, 'infinity', or positive number`,
      );
    }
  });

  if (warnings.length > 0) {
    console.log('⚠️  Configuration warnings:');
    warnings.forEach((warning) => console.log(`   - ${warning}`));
    console.log('');
  }

  return warnings.length === 0;
};

const runTestSuite = async () => {
  console.log('🚀 Phase 2: Full Configuration Testing Suite');
  console.log('='.repeat(50));

  const { testParams, dataset } = testConfig;

  // Validate configuration
  validateConfiguration(testParams);

  const combinations = generateAllCombinations(testParams);
  const repeatCount =
    typeof testParams.REPEAT_COUNT === 'number'
      ? testParams.REPEAT_COUNT
      : testParams.REPEAT_COUNT[0];

  console.log(`📋 Test parameters:`);
  console.log(
    `  - BATCH_SIZE: ${
      Array.isArray(testParams.BATCH_SIZE)
        ? testParams.BATCH_SIZE.join(', ')
        : testParams.BATCH_SIZE
    }`,
  );
  console.log(
    `  - PARALLEL_BATCH_COUNT: ${
      Array.isArray(testParams.PARALLEL_BATCH_COUNT)
        ? testParams.PARALLEL_BATCH_COUNT.join(', ')
        : testParams.PARALLEL_BATCH_COUNT
    }`,
  );
  console.log(
    `  - BATCH_STAGGER: ${
      Array.isArray(testParams.BATCH_STAGGER)
        ? testParams.BATCH_STAGGER.join(', ')
        : testParams.BATCH_STAGGER
    }`,
  );
  console.log(
    `  - FILE_COUNT: ${
      Array.isArray(testParams.FILE_COUNT)
        ? testParams.FILE_COUNT.join(', ')
        : testParams.FILE_COUNT
    }`,
  );
  console.log(
    `  - REPEAT_COUNT: ${repeatCount} (type: ${typeof testParams.REPEAT_COUNT})`,
  );
  console.log(`  - Dataset: ${dataset.shortName} (ID: ${dataset.datasetId})`);
  console.log(`  - Total combinations: ${combinations.length}`);
  console.log(`  - Total test runs: ${combinations.length * repeatCount}`);
  console.log('');

  const results = [];
  const startTime = Date.now();

  for (let repeatRun = 1; repeatRun <= repeatCount; repeatRun++) {
    if (repeatRun > 1) {
      console.log(
        `\n⏳ Waiting 30 seconds before repeat run ${repeatRun}/${repeatCount}...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }

    console.log(
      `\n🔄 Starting repeat run ${repeatRun}/${repeatCount} (total iterations planned: ${repeatCount})`,
    );
    console.log('-'.repeat(40));

    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];
      console.log(`\n📋 Test ${i + 1}/${combinations.length}:`);
      console.log(
        `   BATCH_SIZE: ${combo.BATCH_SIZE}, PARALLEL_BATCH_COUNT: ${combo.PARALLEL_BATCH_COUNT}`,
      );
      console.log(`   BATCH_STAGGER: ${combo.BATCH_STAGGER}ms`);
      console.log(`   FILE_COUNT: ${combo.FILE_COUNT}`);

      // Generate test data for this combination
      const testPayload = {
        ...dataset,
        files: generateTestFiles(combo.FILE_COUNT),
      };

      // Override configuration
      const restoreConfig = overrideBatchConfig({
        BATCH_SIZE: combo.BATCH_SIZE,
        PARALLEL_BATCH_COUNT: combo.PARALLEL_BATCH_COUNT,
        BATCH_STAGGER: combo.BATCH_STAGGER,
      });

      const testStartTime = Date.now();

      try {
        // Execute test
        const mockReq = createMockRequest(testPayload);
        const mockRes = createMockResponse();

        // Re-require the controller after cache clearing
        const {
          downloadDropboxVaultFiles,
        } = require('../controllers/data/dropbox-vault/vaultController');
        console.log('⚡ Executing...');

        await downloadDropboxVaultFiles(mockReq, mockRes);

        const duration = Date.now() - testStartTime;
        const success =
          mockRes.statusCode === 200 &&
          mockRes.response &&
          mockRes.response.success;

        // Record results
        const result = {
          testNumber: i + 1,
          combination: combo,
          success,
          duration,
          statusCode: mockRes.statusCode,
          response: mockRes.response,
          error: null,
        };

        results.push(result);

        if (success) {
          console.log(`✅ SUCCESS - Completed in ${duration}ms`);
          if (mockRes.response.downloadLink) {
            console.log(`🔗 Download link: ${mockRes.response.downloadLink}`);
          }
        } else {
          console.log(`❌ FAILED - Duration: ${duration}ms`);
          console.log(`   Status: ${mockRes.statusCode}`);
          console.log(`   Response:`, mockRes.response);
        }
      } catch (error) {
        const duration = Date.now() - testStartTime;
        console.log(`💥 ERROR - Duration: ${duration}ms`);
        console.log(`   Message: ${error.message}`);

        results.push({
          testNumber: i + 1,
          combination: combo,
          success: false,
          duration,
          statusCode: null,
          response: null,
          error: error.message,
        });
      } finally {
        // Always restore configuration
        restoreConfig();

        // Brief pause between tests to avoid overwhelming the API
        if (i < combinations.length - 1) {
          console.log('⏸️  Pausing between tests...');
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
  }

  const totalDuration = Date.now() - startTime;

  // Generate summary report
  generateSummaryReport(results, totalDuration);

  return results;
};

const generateSummaryReport = (results, totalDuration) => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUITE SUMMARY REPORT');
  console.log('='.repeat(60));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`🏁 Total tests: ${results.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⏱️  Total duration: ${Math.round(totalDuration / 1000)}s`);
  console.log(
    `📈 Success rate: ${Math.round(
      (successful.length / results.length) * 100,
    )}%`,
  );

  if (successful.length > 0) {
    const durations = successful.map((r) => r.duration);
    const avgDuration = Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length,
    );
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    console.log(`\n⚡ Performance Statistics (successful tests):`);
    console.log(`   Average: ${avgDuration}ms`);
    console.log(`   Fastest: ${minDuration}ms`);
    console.log(`   Slowest: ${maxDuration}ms`);

    // Find best performing configuration
    const fastestTest = successful.reduce((prev, current) =>
      prev.duration < current.duration ? prev : current,
    );

    console.log(`\n🏆 Best performing configuration:`);
    console.log(
      `   Test #${fastestTest.testNumber} - ${fastestTest.duration}ms`,
    );
    console.log(`   BATCH_SIZE: ${fastestTest.combination.BATCH_SIZE}`);
    console.log(
      `   PARALLEL_BATCH_COUNT: ${fastestTest.combination.PARALLEL_BATCH_COUNT}`,
    );
    console.log(`   BATCH_STAGGER: ${fastestTest.combination.BATCH_STAGGER}ms`);
    console.log(`   FILE_COUNT: ${fastestTest.combination.FILE_COUNT}`);
  }

  if (failed.length > 0) {
    console.log(`\n💥 Failed test configurations:`);
    failed.forEach((result) => {
      console.log(
        `   Test #${result.testNumber}: ${result.error || 'Response error'}`,
      );
      console.log(
        `     BATCH_SIZE: ${result.combination.BATCH_SIZE}, PARALLEL_BATCH_COUNT: ${result.combination.PARALLEL_BATCH_COUNT}`,
      );
    });
  }

  console.log('\n📋 Individual test results:');
  results.forEach((result) => {
    const status = result.success ? '✅' : '❌';
    const duration = result.duration ? `${result.duration}ms` : 'N/A';
    console.log(
      `   ${status} Test #${result.testNumber}: ${duration} - ` +
        `BS:${result.combination.BATCH_SIZE} PBC:${result.combination.PARALLEL_BATCH_COUNT} ` +
        `FC:${result.combination.FILE_COUNT}`,
    );
  });

  console.log('\n' + '='.repeat(60));
};

if (require.main === module) {
  runTestSuite()
    .then((results) => {
      const successCount = results.filter((r) => r.success).length;
      console.log(`\n🎉 Test suite completed!`);
      console.log(`   ${successCount}/${results.length} tests passed`);

      process.exit(successCount === results.length ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test suite failed with unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { runTestSuite };
