# Batch Configuration Testing Implementation Plan

## Project Overview

Create an automated testing system to evaluate different batch configuration combinations for the Dropbox vault file download system without requiring frontend interaction or server restarts.

## Architecture Analysis

### Existing System Components

1. **Core Function**: `downloadDropboxVaultFilesWithStagedParallel` in `vaultController.js:830`
2. **Configuration System**: `batchConfig.js` with preset configs (conservative, aggressive, sequential)
3. **Execution Engine**: `stagedParallelExecutor.js` with wave-based parallel processing
4. **Performance Logging**: `batchLogger.js` with CSV output to `/notes/batch-performance-metrics.csv`
5. **Retry Logic**: `retryHelpers.js` with exponential backoff and rate limit handling

### Dependencies Analysis

**Required by `downloadDropboxVaultFilesWithStagedParallel`:**

- `req.body`: `{ shortName, datasetId, files }` - **✅ Can be mocked easily**
- `req.reqId`: For logging context - **✅ Can be generated**
- `res`: Express response object for JSON response - **✅ Can be mocked**
- Environment variables for Dropbox API - **✅ Already available**

**NOT Required** (used by other controller functions):

- Database Access (`getDatasetId()`, `directQuery()`)  
- User authentication (`req.user`)
- HTTP session context

**Conclusion**: The core function is **standalone-friendly** and should work without server context!

## Implementation Plan

### Phase 1: Feasibility Test & Standalone Execution

**Goal**: Verify that `downloadDropboxVaultFilesWithStagedParallel` works without HTTP server.

#### 1.1 Test Data Generator (`/batch-test/test-data-generator.js`)

**Generate test data programmatically instead of reading from data.json:**

```javascript
const generateTestFiles = (fileCount) => {
  const files = [];
  for (let i = 1; i <= fileCount; i++) {
    files.push({
      filePath: `/vault/observation/in-situ/cruise/tblPARAGON1_KM2112_Leu_InSitu/rep/${String(i).padStart(3, '0')}.txt`,
      name: `${String(i).padStart(3, '0')}.txt`
    });
  }
  return files;
};

const generateTestPayload = (fileCount = 50) => {
  return {
    shortName: "PARAGON1_KM2112_Leu_InSitu",
    datasetId: 771,
    files: generateTestFiles(fileCount)
  };
};
```

#### 1.2 Mock Request/Response Objects (`/batch-test/mock-http-context.js`)

```javascript
const createMockRequest = (body, reqId = null) => {
  return {
    body,
    reqId: reqId || `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  };
};

const createMockResponse = () => {
  const mockRes = {
    statusCode: 200,
    response: null,
    status: function(code) { 
      this.statusCode = code; 
      return this; 
    },
    json: function(data) { 
      this.response = data; 
      return this; 
    }
  };
  return mockRes;
};
```

#### 1.3 Standalone Test Script (`/batch-test/phase1-feasibility-test.js`)

```javascript
const { downloadDropboxVaultFilesWithStagedParallel } = require('../controllers/data/dropbox-vault/vaultController');
const { generateTestPayload } = require('./test-data-generator');
const { createMockRequest, createMockResponse } = require('./mock-http-context');

const runFeasibilityTest = async () => {
  console.log('🧪 Phase 1: Testing standalone execution...');
  
  // Generate test data
  const testPayload = generateTestPayload(50); // 50 files
  
  // Create mock HTTP context
  const mockReq = createMockRequest(testPayload);
  const mockRes = createMockResponse();
  
  try {
    // Direct call to the function
    await downloadDropboxVaultFilesWithStagedParallel(mockReq, mockRes);
    
    if (mockRes.statusCode === 200 && mockRes.response?.success) {
      console.log('✅ SUCCESS: Standalone execution works!');
      console.log('📊 Response:', mockRes.response);
    } else {
      console.log('❌ FAILED: Unexpected response');
      console.log('📊 Response:', mockRes.response);
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    throw error;
  }
};

if (require.main === module) {
  runFeasibilityTest().catch(console.error);
}
```

#### 1.4 Phase 1 Execution Plan

1. **Generate test data** with 50 files using pattern-based generation
2. **Mock HTTP context** (req/res objects)
3. **Call function directly** with mock context
4. **Verify success** - function completes without server dependency

**Success Criteria**:

- ✅ Function executes without HTTP server
- ✅ Dropbox operations complete successfully  
- ✅ Performance metrics logged to CSV
- ✅ Download link generated in response

### Phase 2: Full Configuration Testing Automation

#### 2.1 Enhanced Test Configuration (`/batch-test/test-configurations.json`)

```json
{
  "dataset": {
    "shortName": "PARAGON1_KM2112_Leu_InSitu",
    "datasetId": 771
  },
  "testParams": {
    "BATCH_SIZE": [5, 10, 25, 50],
    "PARALLEL_COUNT": [1, 2, 3, 5], 
    "WAVE_DELAY": [1000],
    "BATCH_STAGGER": [100],
    "FILE_COUNT": [10, 50, 100]
  }
}
```

#### Parameter Definitions

- **BATCH_SIZE**: Number of files included in each Dropbox batch copy operation
  - Controls how many files are copied together in a single batch request

- **PARALLEL_COUNT**: Number of batches that run simultaneously in each wave
  - Controls concurrency level - how many batch operations execute at the same time
  - Higher values = faster overall completion but more API pressure

- **BATCH_STAGGER**: Delay (in milliseconds) between starting each batch within the same wave
  - 0 = All parallel batches start simultaneously
  - 100 = 100ms delay between each batch start in the same wave
  - Prevents simultaneous API calls to reduce rate limit risk

- **WAVE_DELAY**: Time (in milliseconds) to wait between waves of parallel batches
  - Once all batches in a wave complete, wait this long before starting the next wave
  - Provides breathing room for the API between waves of activity

- **FILE_COUNT**: Total number of test files to generate for each test run
  - Used by test data generator to create the appropriate number of mock files

#### 2.2 Configuration Override System (`/batch-test/config-override.js`)

```javascript
const fs = require('fs');
const path = require('path');

const overrideBatchConfig = (configOverrides) => {
  const configPath = path.resolve(__dirname, '../controllers/data/dropbox-vault/batchConfig.js');
  
  // Read current config
  const originalContent = fs.readFileSync(configPath, 'utf8');
  
  // Create temporary config with overrides
  const overriddenContent = createOverriddenConfig(originalContent, configOverrides);
  
  // Write temporary config
  fs.writeFileSync(configPath, overriddenContent);
  
  // Return restore function
  return () => fs.writeFileSync(configPath, originalContent);
};
```

#### 2.3 Test Runner (`/batch-test/batch-test-runner.js`)

```javascript
const { downloadDropboxVaultFilesWithStagedParallel } = require('../controllers/data/dropbox-vault/vaultController');
const { generateTestPayload } = require('./test-data-generator');
const { createMockRequest, createMockResponse } = require('./mock-http-context');
const { overrideBatchConfig } = require('./config-override');

const runTestSuite = async (testConfig) => {
  const { testParams, dataset } = testConfig;
  const combinations = generateAllCombinations(testParams);
  
  console.log(`🚀 Starting test suite with ${combinations.length} combinations...`);
  
  const results = [];
  
  for (let i = 0; i < combinations.length; i++) {
    const combo = combinations[i];
    console.log(`\n📋 Test ${i + 1}/${combinations.length}:`, combo);
    
    // Generate test data for this combination
    const testPayload = {
      ...dataset,
      files: generateTestFiles(combo.FILE_COUNT)
    };
    
    // Override configuration
    const restoreConfig = overrideBatchConfig(combo);
    
    try {
      // Execute test
      const mockReq = createMockRequest(testPayload);
      const mockRes = createMockResponse();
      
      const startTime = Date.now();
      await downloadDropboxVaultFilesWithStagedParallel(mockReq, mockRes);
      const duration = Date.now() - startTime;
      
      // Record results
      results.push({
        combination: combo,
        success: mockRes.statusCode === 200,
        duration,
        response: mockRes.response
      });
      
      console.log(`✅ Completed in ${duration}ms`);
      
    } catch (error) {
      results.push({
        combination: combo,
        success: false,
        duration: null,
        error: error.message
      });
      console.log(`❌ Failed: ${error.message}`);
    } finally {
      // Always restore configuration
      restoreConfig();
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
};
```

## Key Advantages of This Approach

1. **✅ No Server Required** - Direct function calls with mock HTTP context
2. **✅ No Database Mocking** - Function doesn't use database calls
3. **✅ No Authentication Issues** - Function doesn't check auth
4. **✅ Real Dropbox Operations** - Uses actual Dropbox API  
5. **✅ Pattern-based Data Generation** - No dependency on data.json files
6. **✅ Existing Performance Logging** - Leverages built-in batchLogger.js

## File Structure

```
/batch-test/
├── phase1-feasibility-test.js       # Standalone feasibility test
├── batch-test-runner.js             # Full test suite orchestrator  
├── test-configurations.json         # Test parameters + dataset info
├── test-data-generator.js           # Pattern-based file generation
├── mock-http-context.js             # Mock req/res objects
├── config-override.js              # Configuration override utilities
├── results-analyzer.js             # Performance analysis
└── results/                         # Generated test results
    ├── test-run-[timestamp].json
    └── performance-summary.json
```

## Usage Examples

### Phase 1 Feasibility Test

```bash
cd batch-test
node phase1-feasibility-test.js
```

### Phase 2 Full Test Suite  

```bash
node batch-test-runner.js
```

## Risk Assessment: LOW RISK ✅

Since `downloadDropboxVaultFilesWithStagedParallel` only requires:

- Simple request body data (easily mocked)
- Request ID for logging (easily generated)
- Response object for JSON output (easily mocked)

**This approach should work without any server infrastructure!**

## Next Steps

1. **Create Phase 1 script** to validate feasibility
2. **Test with single configuration** (conservative, 50 files)
3. **Verify Dropbox operations work** in standalone mode
4. **Build full test suite** if Phase 1 succeeds
