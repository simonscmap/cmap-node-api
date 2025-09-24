#!/usr/bin/env node

const EndpointTester = require('../test-endpoints');
const { getBulkDownloadAuth } = require('../testAuthHelper');

async function testBulkDownload() {
  const tester = new EndpointTester();

  const shortNames = [
    'Gradients5_TN412_Hyperpro_Profiles',
    'Gradients5_TN412_FluorometricChlorophyll_UW',
    'Gradients5_TN412_FluorometricChlorophyll_CTD',
  ];

  const filters = {
    temporal: {
      startDate: '2023-01-26',
      endDate: '2023-01-31',
    },
    spatial: {
      latMin: 0,
      latMax: 30,
      lonMin: -140,
      lonMax: -120,
      depthMin: 1,
      depthMax: 5,
    },
  };

  const expectedFileSize = 32589;
  const expectedFileSizeNoFilters = 175828;

  // Login
  const [cmdUsername, cmdPassword] = process.argv.slice(2);
  const bulkAuth = getBulkDownloadAuth();
  const username = cmdUsername || bulkAuth.username;
  const password = cmdPassword || bulkAuth.password;

  console.log('🔐 Logging in...');
  const loginSuccess = await tester.login(username, password);
  if (!loginSuccess) {
    console.log('❌ LOGIN FAILED');
    return;
  }

  // Test 1: With filters
  console.log('\n📋 TEST 1: Bulk download WITH filters');
  console.log(`   Expected size: ${expectedFileSize} bytes`);

  try {
    const result1 = await tester.post(
      '/api/data/bulk-download',
      {
        shortNames: shortNames,
        filters: filters,
      },
      { formData: true },
    );

    if (result1.filePath && result1.fileSize) {
      const sizeMatch = result1.fileSize === expectedFileSize;
      console.log(`✅ File created: ${result1.filePath}`);
      console.log(
        `📊 Size: ${result1.fileSize} bytes ${sizeMatch ? '✅' : '❌'}`,
      );
      if (!sizeMatch) {
        console.log(
          `   Expected: ${expectedFileSize}, Got: ${result1.fileSize}`,
        );
      }
    } else {
      console.log('❌ FAILED - No file created');
      console.log(
        '   Response:',
        result1.error || result1.data || 'Unknown error',
      );
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  // Test 2: Without filters
  console.log('\n📋 TEST 2: Bulk download WITHOUT filters');
  console.log(`   Expected size: ${expectedFileSizeNoFilters} bytes`);

  try {
    const result2 = await tester.post(
      '/api/data/bulk-download',
      {
        shortNames: shortNames,
      },
      { formData: true },
    );

    if (result2.filePath && result2.fileSize) {
      const sizeMatch = result2.fileSize === expectedFileSizeNoFilters;
      console.log(`✅ File created: ${result2.filePath}`);
      console.log(
        `📊 Size: ${result2.fileSize} bytes ${sizeMatch ? '✅' : '❌'}`,
      );
      if (!sizeMatch) {
        console.log(
          `   Expected: ${expectedFileSizeNoFilters}, Got: ${result2.fileSize}`,
        );
      }
    } else {
      console.log('❌ FAILED - No file created');
      console.log(
        '   Response:',
        result2.error || result2.data || 'Unknown error',
      );
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  console.log('\n🏁 Test complete');
}

testBulkDownload().catch(console.error);
