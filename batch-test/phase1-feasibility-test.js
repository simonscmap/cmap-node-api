const { downloadDropboxVaultFiles } = require('../controllers/data/dropbox-vault/vaultController');
const { generateTestPayload } = require('./test-data-generator');
const { createMockRequest, createMockResponse } = require('./mock-http-context');

const runFeasibilityTest = async () => {
  console.log('🧪 Phase 1: Testing standalone execution...');
  
  // Generate test data
  const testPayload = generateTestPayload(50); // 50 files
  
  // Create mock HTTP context
  const mockReq = createMockRequest(testPayload);
  const mockRes = createMockResponse();
  
  console.log('📋 Test parameters:');
  console.log(`  - Files: ${testPayload.files.length}`);
  console.log(`  - Dataset: ${testPayload.shortName} (ID: ${testPayload.datasetId})`);
  console.log(`  - Request ID: ${mockReq.reqId}`);
  console.log('');
  
  try {
    // Direct call to the function
    console.log('⚡ Executing downloadDropboxVaultFilesWithStagedParallel...');
    const startTime = Date.now();
    
    await downloadDropboxVaultFiles(mockReq, mockRes);
    
    const duration = Date.now() - startTime;
    
    if (mockRes.statusCode === 200 && mockRes.response && mockRes.response.success) {
      console.log('✅ SUCCESS: Standalone execution works!');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log('📊 Response:', mockRes.response);
      return true;
    } else {
      console.log('❌ FAILED: Unexpected response');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log('📊 Status Code:', mockRes.statusCode);
      console.log('📊 Response:', mockRes.response);
      return false;
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    console.error('Full error:', error);
    return false;
  }
};

if (require.main === module) {
  runFeasibilityTest()
    .then(success => {
      console.log('');
      console.log(success ? 
        '🎉 Phase 1 completed successfully! Ready for Phase 2.' : 
        '💥 Phase 1 failed. Check errors above.'
      );
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { runFeasibilityTest };