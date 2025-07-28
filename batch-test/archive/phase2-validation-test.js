require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  generateTestFiles,
  generateTestPayload,
} = require('../test-data-generator');
const {
  createMockRequest,
  createMockResponse,
} = require('../mock-http-context');
const {
  overrideBatchConfig,
  generateAllCombinations,
} = require('../config-override');

const runValidationTest = async () => {
  console.log('🧪 Phase 2 Validation: Testing config override system...');

  // Use minimal test configuration
  const minimalTestConfig = require('../test-configurations-minimal.json');
  const { testParams, dataset } = minimalTestConfig;
  const combinations = generateAllCombinations(testParams);

  console.log(`📋 Validation parameters:`);
  console.log(`  - Total combinations: ${combinations.length}`);
  console.log(`  - Dataset: ${dataset.shortName}`);
  console.log('');

  if (combinations.length === 0) {
    console.log('❌ No test combinations generated!');
    return false;
  }

  // Test just the first combination to validate the system
  const combo = combinations[0];
  console.log(`🔧 Testing configuration override:`);
  console.log(`   BATCH_SIZE: ${combo.BATCH_SIZE}`);
  console.log(`   PARALLEL_COUNT: ${combo.PARALLEL_COUNT}`);
  console.log(`   WAVE_DELAY: ${combo.WAVE_DELAY}ms`);
  console.log(`   BATCH_STAGGER: ${combo.BATCH_STAGGER}ms`);
  console.log(`   FILE_COUNT: ${combo.FILE_COUNT}`);

  // Generate test data
  const testPayload = {
    ...dataset,
    files: generateTestFiles(combo.FILE_COUNT),
  };

  console.log(`📁 Generated ${testPayload.files.length} test files`);

  // Test config override system
  console.log('⚙️  Testing configuration override...');
  const restoreConfig = overrideBatchConfig({
    BATCH_SIZE: combo.BATCH_SIZE,
    PARALLEL_COUNT: combo.PARALLEL_COUNT,
    WAVE_DELAY: combo.WAVE_DELAY,
    BATCH_STAGGER: combo.BATCH_STAGGER,
  });

  // Verify the config was overridden by checking the file
  const configPath = path.resolve(
    __dirname,
    '../controllers/data/dropbox-vault/batchConfig.js',
  );
  const modifiedConfig = fs.readFileSync(configPath, 'utf8');

  if (
    modifiedConfig.includes("CURRENT_CONFIG = 'test'") &&
    modifiedConfig.includes('test: {')
  ) {
    console.log('✅ Configuration override successful');
  } else {
    console.log('❌ Configuration override failed');
    restoreConfig();
    return false;
  }

  try {
    // Test the actual function call
    console.log('⚡ Testing function execution...');
    const mockReq = createMockRequest(testPayload);
    const mockRes = createMockResponse();

    // Re-require the controller after cache clearing
    const {
      downloadDropboxVaultFiles,
    } = require('../../controllers/data/dropbox-vault/vaultController');

    const startTime = Date.now();
    await downloadDropboxVaultFiles(mockReq, mockRes);
    const duration = Date.now() - startTime;

    const success =
      mockRes.statusCode === 200 &&
      mockRes.response &&
      mockRes.response.success;

    if (success) {
      console.log('✅ Function execution successful');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log('📊 Response keys:', Object.keys(mockRes.response));
      return true;
    } else {
      console.log('❌ Function execution failed');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log('📊 Status Code:', mockRes.statusCode);
      console.log('📊 Response:', mockRes.response);
      return false;
    }
  } catch (error) {
    console.log('💥 Function execution error:', error.message);
    return false;
  } finally {
    // Always restore configuration
    console.log('🔄 Restoring original configuration...');
    restoreConfig();

    // Verify restoration
    const restoredConfig = fs.readFileSync(configPath, 'utf8');
    if (!restoredConfig.includes("CURRENT_CONFIG = 'test'")) {
      console.log('✅ Configuration restored successfully');
    } else {
      console.log('⚠️  Configuration restoration may have failed');
    }
  }
};

if (require.main === module) {
  runValidationTest()
    .then((success) => {
      console.log('');
      if (success) {
        console.log(
          '🎉 Phase 2 validation passed! Ready to run full test suite.',
        );
        console.log('💡 Run: node batch-test/batch-test-runner.js');
      } else {
        console.log('💥 Phase 2 validation failed. Check errors above.');
      }
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Unexpected validation error:', error);
      process.exit(1);
    });
}

module.exports = { runValidationTest };
