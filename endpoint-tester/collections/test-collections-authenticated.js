#!/usr/bin/env node

/**
 * T005: Manual test script for GET /api/collections (authenticated access)
 *
 * Test scenario: Authenticated User Access (Public + Own Private)
 * - Should return public collections + user's private collections
 * - Requires authentication
 * - Should include ownership information
 * - Should validate user context
 */

const EndpointTester = require('./test-endpoints.js');

async function testAuthenticatedCollections() {
  console.log('🧪 Testing Collections API - Authenticated Access');
  console.log('='.repeat(50));

  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('❌ Usage: node test-collections-authenticated.js <username> <password>');
    process.exit(1);
  }

  const [username, password] = args;
  const tester = new EndpointTester();

  console.log(`\n🔐 Logging in as: ${username}`);
  const loginSuccess = await tester.login(username, password);

  if (!loginSuccess) {
    console.log('❌ Login failed - cannot test authenticated access');
    return false;
  }

  console.log('\n📝 Test Case: GET /api/collections (authenticated)');
  console.log('Expected: Public collections + user\'s private collections');
  console.log('Expected: User ownership information included');

  // Test authenticated collections endpoint
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
    const expectedFields = ['id', 'name', 'description', 'isPublic', 'createdAt', 'updatedAt', 'userId', 'isOwner'];

    console.log('\n🔍 Validating collection structure:');
    for (const field of expectedFields) {
      if (firstCollection.hasOwnProperty(field)) {
        console.log(`✅ Field '${field}': ${typeof firstCollection[field]}`);
      } else {
        console.log(`⚠️  Missing field '${field}'`);
      }
    }

    // Analyze collection access patterns
    const publicCollections = data.filter(col => col.isPublic === true);
    const privateCollections = data.filter(col => col.isPublic === false);
    const ownedCollections = data.filter(col => col.isOwner === true);

    console.log('\n📊 Access Analysis:');
    console.log(`- Public collections: ${publicCollections.length}`);
    console.log(`- Private collections: ${privateCollections.length}`);
    console.log(`- Owned collections: ${ownedCollections.length}`);

    // Validate that all private collections are owned by user
    const unauthorizedPrivate = privateCollections.filter(col => col.isOwner !== true);
    if (unauthorizedPrivate.length > 0) {
      console.log(`❌ Found ${unauthorizedPrivate.length} private collections not owned by user`);
      return false;
    } else {
      console.log('✅ All private collections are owned by authenticated user');
    }
  }

  // Test without authentication for comparison
  console.log('\n📝 Comparison Test: Anonymous access');
  const anonTester = new EndpointTester();
  const anonResult = await anonTester.get('/api/collections');

  if (anonResult.data && Array.isArray(anonResult.data)) {
    const anonCount = anonResult.data.length;
    const authCount = data.length;
    const additionalCollections = authCount - anonCount;

    console.log(`- Anonymous collections: ${anonCount}`);
    console.log(`- Authenticated collections: ${authCount}`);
    console.log(`- Additional with auth: ${additionalCollections}`);

    if (additionalCollections >= 0) {
      console.log('✅ Authentication provides equal or more collections');
    } else {
      console.log('❌ Authentication shows fewer collections than anonymous');
      return false;
    }
  }

  console.log('\n📊 Test Summary:');
  console.log(`- Collections returned: ${data.length}`);
  console.log('- Authenticated access: ✅ Working');
  console.log('- Private collection filtering: ✅ Working');
  console.log('- Ownership validation: ✅ Working');

  return true;
}

// Run test if called directly
if (require.main === module) {
  testAuthenticatedCollections()
    .then(success => {
      if (success) {
        console.log('\n🎉 Authenticated collections test PASSED');
        process.exit(0);
      } else {
        console.log('\n💥 Authenticated collections test FAILED');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test error:', error);
      process.exit(1);
    });
}

module.exports = testAuthenticatedCollections;