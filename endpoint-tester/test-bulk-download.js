#!/usr/bin/env node

const EndpointTester = require('./test-endpoints');

// Download directory configuration
const DOWNLOAD_DIR = '/Users/howardwkim/Downloads';

async function testBulkDownload() {
  const tester = new EndpointTester('http://localhost:8080', DOWNLOAD_DIR);

  // Dataset short names from your file
  const shortNames = [
    // 'Gradients5_TN412_Hyperpro_Profiles',
    // 'Gradients5_TN412_FluorometricChlorophyll_UW',
    // 'Gradients5_TN412_FluorometricChlorophyll_CTD',
    'soluble_deposition_histories',
  ];

  // Filters based on your constraints: Time: 1.26.2023 - 1.31.2023 Depth: 0-20 Lat: 0-30 Lon: -140 - -120
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
    },
    depth: {
      min: 0,
      max: 20,
    },
  };

  console.log('🧪 Testing Bulk Download Endpoint');
  console.log('📋 Datasets:', shortNames.length);
  console.log(
    '📅 Time:',
    filters.temporal.startDate,
    'to',
    filters.temporal.endDate,
  );
  console.log('🌐 Lat:', filters.spatial.latMin, 'to', filters.spatial.latMax);
  console.log('🌐 Lon:', filters.spatial.lonMin, 'to', filters.spatial.lonMax);
  console.log('🌊 Depth:', filters.depth.min, 'to', filters.depth.max);

  // Login with credentials (command line args override defaults)
  const [cmdUsername, cmdPassword] = process.argv.slice(2);
  const username = cmdUsername || 'howiewkim@gmail.com';
  const password = cmdPassword || 'WkT*JDvDfk&Q62';

  console.log('🔐 Attempting login...');
  const loginSuccess = await tester.login(username, password);
  if (!loginSuccess) {
    console.log('❌ Login failed - aborting test');
    return;
  }

  // Prepare the request body (the API expects form data)
  const requestBody = {
    shortNames: shortNames,
    // filters: filters,
  };

  console.log('🚀 Sending bulk download request...');

  try {
    const result = await tester.post('/api/data/bulk-download', requestBody, {
      formData: true,
    });

    if (result.filePath) {
      console.log('🎉 Success! Downloaded file:', result.filePath);
      console.log('📊 File size:', result.fileSize, 'bytes');
    } else if (result.error) {
      console.log('❌ Request failed:', result.error);
    } else if (result.data) {
      console.log('⚠️  Unexpected response (not a file):', result.data);
    }
  } catch (error) {
    console.log('💥 Error:', error.message);
  }
}

// Command line usage info
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
📋 Bulk Download Tester

Usage:
  node test-bulk-download.js [username] [password]

Examples:
  node test-bulk-download.js                    # Test as guest
  node test-bulk-download.js myuser mypass     # Test with authentication

This will test the /api/data/bulk-download endpoint with predefined datasets and filters.
  `);
  process.exit(0);
}

// Run the test
testBulkDownload().catch(console.error);
