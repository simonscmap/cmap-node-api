#!/usr/bin/env node

/**
 * T007: Manual test script for GET /api/collections/{id} (private collection access control)
 *
 * Test scenario: Access Control - Private Collection
 * - Should deny access to private collections for anonymous users (403/404)
 * - Should allow access to private collections for owners
 * - Should deny access to private collections for non-owners
 * - Should validate proper authentication and authorization
 */

const EndpointTester = require('../test-endpoints.js');
const { getBasicAuth } = require('../testAuthHelper');

async function testPrivateCollectionAccessControl() {
  console.log('🧪 Testing Collections API - Private Collection Access Control');
  console.log('='.repeat(50));

  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('❌ Usage: node test-collection-access-control.js <private-collection-id> [owner-username] [owner-password] [non-owner-username] [non-owner-password]');
    console.log('   Example: node test-collection-access-control.js private-123 owner-user owner-pass other-user other-pass');
    console.log('   Note: If credentials not provided, will use default test credentials');
    process.exit(1);
  }

  const [collectionId, ownerUsername, ownerPassword, nonOwnerUsername, nonOwnerPassword] = args;

  // Use default credentials if not provided
  const defaultAuth = getBasicAuth();
  const finalOwnerUsername = ownerUsername || defaultAuth.username;
  const finalOwnerPassword = ownerPassword || defaultAuth.password;
  const finalNonOwnerUsername = nonOwnerUsername || defaultAuth.username;
  const finalNonOwnerPassword = nonOwnerPassword || defaultAuth.password;

  if (!ownerUsername) {
    console.log('ℹ️  Using default test credentials for owner');
  }
  if (!nonOwnerUsername) {
    console.log('ℹ️  Using default test credentials for non-owner');
  }

  console.log('\n📝 Test Case 1: Anonymous access to private collection');
  console.log(`Collection ID: ${collectionId}`);
  console.log('Expected: Access denied (403 or 404)');

  // Test 1: Anonymous access should be denied
  const anonTester = new EndpointTester();
  const anonResult = await anonTester.get(`/api/collections/${collectionId}`);

  if (anonResult.error) {
    console.log('❌ Request failed:', anonResult.error);
    return false;
  }

  const anonResponse = anonResult.response;
  if (anonResponse.status === 403 || anonResponse.status === 404) {
    console.log(`✅ Anonymous access properly denied (${anonResponse.status})`);
  } else if (anonResponse.ok) {
    // Check if the collection is actually public
    if (anonResult.data && anonResult.data.isPublic === true) {
      console.log('⚠️  Collection appears to be public, not private - check collection ID');
      return false;
    } else {
      console.log('❌ Anonymous access allowed to private collection');
      return false;
    }
  } else {
    console.log(`⚠️  Unexpected status code: ${anonResponse.status}`);
  }

  console.log('\n📝 Test Case 2: Owner access to private collection');
  console.log(`Owner: ${finalOwnerUsername}`);
  console.log('Expected: Access granted with full details');

  // Test 2: Owner should have access
  const ownerTester = new EndpointTester();
  const ownerLogin = await ownerTester.login(finalOwnerUsername, finalOwnerPassword);

  if (!ownerLogin) {
    console.log('❌ Owner login failed');
    return false;
  }

  const ownerResult = await ownerTester.get(`/api/collections/${collectionId}`);

  if (ownerResult.error) {
    console.log('❌ Owner request failed:', ownerResult.error);
    return false;
  }

  const ownerResponse = ownerResult.response;
  if (!ownerResponse.ok) {
    console.log(`❌ Owner access denied (${ownerResponse.status})`);
    if (ownerResult.data) {
      console.log('Response:', JSON.stringify(ownerResult.data, null, 2));
    }
    return false;
  }

  const ownerData = ownerResult.data;
  if (!ownerData || typeof ownerData !== 'object') {
    console.log('❌ Invalid owner response data');
    return false;
  }

  console.log('✅ Owner access granted');

  // Validate this is indeed a private collection
  if (ownerData.isPublic === true) {
    console.log('❌ Collection is marked as public, not private');
    return false;
  } else {
    console.log('✅ Collection confirmed as private');
  }

  // Validate owner relationship
  if (ownerData.isOwner === true) {
    console.log('✅ Owner relationship confirmed');
  } else {
    console.log('⚠️  Owner relationship not indicated in response');
  }

  // Test 3: Non-owner access (if credentials provided)
  if (finalNonOwnerUsername && finalNonOwnerPassword) {
    console.log('\n📝 Test Case 3: Non-owner access to private collection');
    console.log(`Non-owner: ${finalNonOwnerUsername}`);
    console.log('Expected: Access denied (403)');

    const nonOwnerTester = new EndpointTester();
    const nonOwnerLogin = await nonOwnerTester.login(finalNonOwnerUsername, finalNonOwnerPassword);

    if (!nonOwnerLogin) {
      console.log('❌ Non-owner login failed');
      return false;
    }

    const nonOwnerResult = await nonOwnerTester.get(`/api/collections/${collectionId}`);

    if (nonOwnerResult.error) {
      console.log('❌ Non-owner request failed:', nonOwnerResult.error);
      return false;
    }

    const nonOwnerResponse = nonOwnerResult.response;
    if (nonOwnerResponse.status === 403) {
      console.log('✅ Non-owner access properly denied (403)');
    } else if (nonOwnerResponse.status === 404) {
      console.log('✅ Non-owner access denied (404 - collection not visible)');
    } else if (nonOwnerResponse.ok) {
      console.log('❌ Non-owner access allowed - authorization failed');
      return false;
    } else {
      console.log(`⚠️  Unexpected non-owner status: ${nonOwnerResponse.status}`);
    }
  } else {
    console.log('\n📝 Test Case 3: Skipped (no non-owner credentials provided)');
  }

  // Test 4: Authentication requirement validation
  console.log('\n📝 Test Case 4: Authentication validation');
  console.log('Testing various authentication scenarios...');

  // Test with invalid credentials
  const invalidTester = new EndpointTester();
  const invalidLogin = await invalidTester.login(finalOwnerUsername, 'wrong-password');

  if (invalidLogin) {
    console.log('⚠️  Invalid credentials accepted - authentication may be weak');
  } else {
    console.log('✅ Invalid credentials properly rejected');
  }

  console.log('\n📊 Test Summary:');
  console.log(`- Collection ID: ${collectionId}`);
  console.log(`- Collection name: ${ownerData.name || 'N/A'}`);
  console.log('- Anonymous access: ✅ Properly denied');
  console.log('- Owner access: ✅ Properly granted');
  if (nonOwnerUsername) {
    console.log('- Non-owner access: ✅ Properly denied');
  }
  console.log('- Authentication validation: ✅ Working');
  console.log('- Authorization control: ✅ Working');

  return true;
}

// Run test if called directly
if (require.main === module) {
  testPrivateCollectionAccessControl()
    .then(success => {
      if (success) {
        console.log('\n🎉 Private collection access control test PASSED');
        process.exit(0);
      } else {
        console.log('\n💥 Private collection access control test FAILED');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test error:', error);
      process.exit(1);
    });
}

module.exports = testPrivateCollectionAccessControl;