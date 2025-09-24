#!/usr/bin/env node

const EndpointTester = require('../test-endpoints');

async function testBulkDownloadInit() {
  const tester = new EndpointTester();

  const shortNames = [
    'Gradients5_TN412_Hyperpro_Profiles',
    'Gradients5_TN412_FluorometricChlorophyll_UW',
    'Gradients5_TN412_FluorometricChlorophyll_CTD',
  ];

  // Login
  const [cmdUsername, cmdPassword] = process.argv.slice(2);
  const username = cmdUsername || 'howiewkim@gmail.com';
  const password = cmdPassword || 'WkT*JDvDfk&Q62';

  console.log('🔐 Logging in...');
  const loginSuccess = await tester.login(username, password);
  if (!loginSuccess) {
    console.log('❌ LOGIN FAILED');
    return;
  }

  // Test: Valid shortNames
  console.log('\n📋 Testing bulk download init with shortNames');
  console.log('   shortNames:', shortNames);

  try {
    const result = await tester.post('/api/data/bulk-download-init', {
      shortNames: shortNames,
    });

    if (result.error) {
      console.log('❌ FAILED:', result.error);
      console.log('   Message:', result.message || 'No message');
    } else {
      console.log('✅ SUCCESS');
      console.log('\n📄 Data object:');
      console.log(JSON.stringify(result.data, null, 2));
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  console.log('\n🏁 Test complete');
}

testBulkDownloadInit().catch(console.error);