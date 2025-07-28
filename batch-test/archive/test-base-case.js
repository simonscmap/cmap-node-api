require('dotenv').config();
const {
  chunkArray,
} = require('../../controllers/data/dropbox-vault/stagedParallelExecutor.js');
const { overrideBatchConfig } = require('../config-override.js');
const testConfig = require('../test-configuration-base-case.json');

const testBaseCase = async () => {
  console.log('🧪 Testing Base Case Configuration');
  console.log('='.repeat(40));

  const { testParams, dataset } = testConfig;
  console.log('📋 Configuration from test-configuration-base-case.json:');
  console.log(`   BATCH_SIZE: ${JSON.stringify(testParams.BATCH_SIZE)}`);
  console.log(
    `   PARALLEL_COUNT: ${JSON.stringify(testParams.PARALLEL_COUNT)}`,
  );
  console.log(`   WAVE_DELAY: ${JSON.stringify(testParams.WAVE_DELAY)}`);
  console.log(`   BATCH_STAGGER: ${JSON.stringify(testParams.BATCH_STAGGER)}`);
  console.log(`   FILE_COUNT: ${JSON.stringify(testParams.FILE_COUNT)}`);
  console.log(
    `   REPEAT_COUNT: ${JSON.stringify(
      testParams.REPEAT_COUNT,
    )} (type: ${typeof testParams.REPEAT_COUNT})`,
  );
  console.log('');

  // Test different file counts
  const fileCounts = testParams.FILE_COUNT;
  const batchSize = testParams.BATCH_SIZE[0];

  console.log('🔬 Testing chunkArray behavior with base case settings:');

  for (const fileCount of fileCounts) {
    console.log(
      `\n📁 Testing with ${fileCount} files, BATCH_SIZE: ${batchSize}`,
    );

    // Create dummy file array
    const files = Array.from({ length: fileCount }, (_, i) => ({
      id: i + 1,
      name: `file${i + 1}.txt`,
    }));

    const batches = chunkArray(files, batchSize);

    console.log(
      `   Result: ${batches.length} batch${
        batches.length === 1 ? '' : 'es'
      } created`,
    );
    console.log(`   Batch sizes: ${batches.map((b) => b.length).join(', ')}`);

    // Verify expectation: should always create exactly 1 batch
    if (batches.length === 1) {
      console.log(`   ✅ CORRECT - Single batch created as expected`);
    } else {
      console.log(`   ❌ ERROR - Expected 1 batch, got ${batches.length}`);
    }
  }

  console.log('\n🔧 Testing config override system:');

  // Test the config override to ensure it properly handles -1
  const restoreConfig = overrideBatchConfig({
    BATCH_SIZE: batchSize,
    PARALLEL_COUNT: testParams.PARALLEL_COUNT[0],
    WAVE_DELAY: testParams.WAVE_DELAY[0],
    BATCH_STAGGER: testParams.BATCH_STAGGER[0],
  });

  try {
    // Re-require the batchConfig to see the generated config
    delete require.cache[
      require.resolve('../controllers/data/dropbox-vault/batchConfig.js')
    ];
    const {
      getCurrentConfig,
    } = require('../../controllers/data/dropbox-vault/batchConfig.js');
    const config = getCurrentConfig();

    console.log(`   Generated BATCH_SIZE in config: ${config.BATCH_SIZE}`);
    console.log(
      `   Generated PARALLEL_COUNT in config: ${config.PARALLEL_COUNT}`,
    );
    console.log(`   Generated WAVE_DELAY in config: ${config.WAVE_DELAY}`);
    console.log(
      `   Generated BATCH_STAGGER in config: ${config.BATCH_STAGGER}`,
    );
    console.log(`   Config name: ${config.name}`);

    if (config.BATCH_SIZE === -1) {
      console.log(`   ✅ CORRECT - Config override properly converted to -1`);
    } else {
      console.log(`   ❌ ERROR - Expected -1, got ${config.BATCH_SIZE}`);
    }
  } finally {
    restoreConfig();
  }

  console.log('\n' + '='.repeat(40));
  console.log('✅ Base case testing completed');
};

if (require.main === module) {
  testBaseCase()
    .then(() => {
      console.log('🎉 Base case test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Base case test failed:', error);
      process.exit(1);
    });
}

module.exports = { testBaseCase };
