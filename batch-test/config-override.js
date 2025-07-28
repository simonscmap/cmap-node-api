const fs = require('fs');
const path = require('path');

const overrideBatchConfig = (configOverrides) => {
  const configPath = path.resolve(__dirname, '../controllers/data/dropbox-vault/batchConfig.js');
  const vaultControllerPath = path.resolve(__dirname, '../controllers/data/dropbox-vault/vaultController.js');
  
  // Read current config
  const originalContent = fs.readFileSync(configPath, 'utf8');
  
  // Create temporary config with overrides
  const overriddenContent = createOverriddenConfig(originalContent, configOverrides);
  
  // Write temporary config
  fs.writeFileSync(configPath, overriddenContent);
  
  // Clear Node.js module cache to force reload of config and related modules
  delete require.cache[configPath];
  delete require.cache[vaultControllerPath];
  
  // Also clear any other modules that might import batchConfig
  Object.keys(require.cache).forEach(key => {
    if (key.includes('dropbox-vault') || key.includes('batchConfig')) {
      delete require.cache[key];
    }
  });
  
  // Return restore function
  return () => {
    fs.writeFileSync(configPath, originalContent);
    // Clear cache again when restoring
    delete require.cache[configPath];
    delete require.cache[vaultControllerPath];
    Object.keys(require.cache).forEach(key => {
      if (key.includes('dropbox-vault') || key.includes('batchConfig')) {
        delete require.cache[key];
      }
    });
  };
};

const createOverriddenConfig = (originalContent, overrides) => {
  // Handle special infinity case for BATCH_SIZE
  let batchSizeValue = overrides.BATCH_SIZE || 10;
  if (batchSizeValue === 'infinity') {
    batchSizeValue = -1; // Use -1 as infinity marker
  }
  
  // Create a test config based on conservative with overrides
  const testConfigSection = `  test: {
    // === BATCH EXECUTION SETTINGS ===
    BATCH_SIZE: ${batchSizeValue},
    PARALLEL_BATCH_COUNT: ${overrides.PARALLEL_BATCH_COUNT || 2},
    BATCH_STAGGER: ${overrides.BATCH_STAGGER !== undefined ? overrides.BATCH_STAGGER : 100},

    // === RETRY CONFIGURATION ===
    MAX_RETRIES: 3,
    RETRY_BASE_DELAY: 2000,
    RETRY_MAX_DELAY: 60000,

    // === TIMEOUT SETTINGS ===
    BATCH_TIMEOUT: 300000,
    POLL_INTERVAL: 5000,

    // === RATE LIMIT HANDLING ===
    RATE_LIMIT_BACKOFF: 30000,
    JITTER_MAX: 1000,
  },`;

  // Replace the CURRENT_CONFIG to use 'test'
  let modifiedContent = originalContent.replace(
    /const CURRENT_CONFIG = '[^']+';/,
    "const CURRENT_CONFIG = 'test';"
  );

  // Add the test configuration to BATCH_CONFIGS
  modifiedContent = modifiedContent.replace(
    /const BATCH_CONFIGS = \{/,
    `const BATCH_CONFIGS = {\n${testConfigSection}`
  );

  return modifiedContent;
};

const generateAllCombinations = (testParams) => {
  const combinations = [];
  // Exclude REPEAT_COUNT from combination generation since it's not part of test parameters
  const keys = Object.keys(testParams).filter(key => key !== 'REPEAT_COUNT');
  
  const generateCombos = (keyIndex, currentCombo) => {
    if (keyIndex === keys.length) {
      combinations.push({ ...currentCombo });
      return;
    }
    
    const key = keys[keyIndex];
    const values = testParams[key];
    
    for (const value of values) {
      currentCombo[key] = value;
      generateCombos(keyIndex + 1, currentCombo);
    }
  };
  
  generateCombos(0, {});
  return combinations;
};

module.exports = {
  overrideBatchConfig,
  generateAllCombinations
};