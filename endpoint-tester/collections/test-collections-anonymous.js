#!/usr/bin/env node

/**
 * T004: Manual test script for GET /api/collections (anonymous access)
 *
 * Test scenario: Anonymous User Access (Public Collections Only)
 * - Should return only public collections
 * - Should not require authentication
 * - Response should exclude private collections
 * - Should include standard collection metadata
 */

const EndpointTester = require('../test-endpoints.js');

async function testAnonymousCollections() {
  console.log('🧪 Testing Collections API - Anonymous Access');
  console.log('='.repeat(50));

  const tester = new EndpointTester();

  console.log('\n📝 Test Case: GET /api/collections (anonymous)');
  console.log('Expected: Only public collections returned');
  console.log('Expected: No authentication required');

  // Test basic collections endpoint
  const result = await tester.get('/api/collections');

  if (result.error) {
    console.log('❌ Request failed:', result.error);
    return false;
  }

  const { response, data } = result;

  // Validate response structure
  if (!response.ok) {
    console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
    if (data) {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    return false;
  }

  // Validate data structure
  if (!Array.isArray(data)) {
    console.log('❌ Expected array response, got:', typeof data);
    return false;
  }

  console.log(`✅ Received ${data.length} collections`);

  // Validate collection structure
  if (data.length > 0) {
    const firstCollection = data[0];
    const expectedFields = ['id', 'name', 'description', 'isPublic', 'createdDate', 'modifiedDate'];

    console.log('\n🔍 Validating collection structure:');
    for (const field of expectedFields) {
      if (firstCollection.hasOwnProperty(field)) {
        console.log(`✅ Field '${field}': ${typeof firstCollection[field]}`);
      } else {
        console.log(`⚠️  Missing field '${field}'`);
      }
    }

    // Check that all collections are public for anonymous access
    const privateCollections = data.filter(col => col.isPublic === false);
    if (privateCollections.length > 0) {
      console.log(`❌ Found ${privateCollections.length} private collections in anonymous response`);
      return false;
    } else {
      console.log('✅ All returned collections are public');
    }
  }

  console.log('\n📊 Test Summary:');
  console.log(`- Collections returned: ${data.length}`);
  console.log('- Anonymous access: ✅ Working');
  console.log('- Public only filtering: ✅ Working');

  return true;
}

// Run test if called directly
if (require.main === module) {
  testAnonymousCollections()
    .then(success => {
      if (success) {
        console.log('\n🎉 Anonymous collections test PASSED');
        process.exit(0);
      } else {
        console.log('\n💥 Anonymous collections test FAILED');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test error:', error);
      process.exit(1);
    });
}

module.exports = testAnonymousCollections;