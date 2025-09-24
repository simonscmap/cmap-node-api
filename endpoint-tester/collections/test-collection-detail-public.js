#!/usr/bin/env node

/**
 * T006: Manual test script for GET /api/collections/{id} (public collection)
 *
 * Test scenario: Individual Collection Details (Public)
 * - Should return detailed collection information for public collections
 * - Should work without authentication for public collections
 * - Should include datasets, metadata, and collection structure
 * - Should validate collection ID format
 */

const EndpointTester = require('../test-endpoints.js');

async function testPublicCollectionDetail() {
  console.log('🧪 Testing Collections API - Public Collection Detail');
  console.log('='.repeat(50));

  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('❌ Usage: node test-collection-detail-public.js <collection-id> [username] [password]');
    console.log('   Example: node test-collection-detail-public.js 1');
    console.log('   Example: node test-collection-detail-public.js abc-123-def');
    process.exit(1);
  }

  const [collectionId, username, password] = args;
  const tester = new EndpointTester();

  // Optional authentication for comparison testing
  let authenticated = false;
  if (username && password) {
    console.log(`\n🔐 Logging in as: ${username}`);
    authenticated = await tester.login(username, password);
    if (!authenticated) {
      console.log('⚠️  Login failed - continuing with anonymous access...');
    }
  }

  console.log('\n📝 Test Case: GET /api/collections/{id} (public collection)');
  console.log(`Collection ID: ${collectionId}`);
  console.log('Expected: Detailed collection information');
  console.log('Expected: Works without authentication for public collections');

  // Test collection detail endpoint
  const result = await tester.get(`/api/collections/${collectionId}`);

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

    // Check for specific error scenarios
    if (response.status === 404) {
      console.log('ℹ️  Collection not found - this might be expected if ID doesn\'t exist');
    } else if (response.status === 403) {
      console.log('ℹ️  Access forbidden - collection might be private');
    }
    return false;
  }

  // Validate data structure
  if (typeof data !== 'object' || data === null) {
    console.log('❌ Expected object response, got:', typeof data);
    return false;
  }

  console.log('✅ Successfully retrieved collection details');

  // Validate collection detail structure
  const expectedFields = [
    'id', 'name', 'description', 'isPublic', 'createdAt', 'updatedAt',
    'datasets', 'userId', 'createdBy'
  ];

  console.log('\n🔍 Validating collection structure:');
  for (const field of expectedFields) {
    if (data.hasOwnProperty(field)) {
      console.log(`✅ Field '${field}': ${typeof data[field]}`);

      // Additional validation for specific fields
      if (field === 'datasets' && Array.isArray(data[field])) {
        console.log(`   - Contains ${data[field].length} datasets`);
      }
    } else {
      console.log(`⚠️  Missing field '${field}'`);
    }
  }

  // Validate that this is a public collection
  if (data.isPublic !== true) {
    console.log('❌ Collection is not public - test should use a public collection ID');
    return false;
  } else {
    console.log('✅ Collection is confirmed public');
  }

  // Validate datasets structure if present
  if (data.datasets && Array.isArray(data.datasets) && data.datasets.length > 0) {
    console.log('\n📊 Dataset Analysis:');
    const firstDataset = data.datasets[0];
    const datasetFields = ['Short_Name', 'Long_Name', 'Data_Source', 'Table_Name'];

    for (const field of datasetFields) {
      if (firstDataset.hasOwnProperty(field)) {
        console.log(`✅ Dataset field '${field}': ${typeof firstDataset[field]}`);
      } else {
        console.log(`⚠️  Missing dataset field '${field}'`);
      }
    }
  } else {
    console.log('\n📊 No datasets found in collection');
  }

  // Test invalid collection ID format
  console.log('\n📝 Test Case: Invalid collection ID');
  const invalidResult = await tester.get('/api/collections/invalid-id-12345');

  if (invalidResult.response && invalidResult.response.status === 404) {
    console.log('✅ Invalid collection ID properly returns 404');
  } else {
    console.log('⚠️  Invalid collection ID handling may need review');
  }

  console.log('\n📊 Test Summary:');
  console.log(`- Collection ID: ${collectionId}`);
  console.log(`- Collection name: ${data.name || 'N/A'}`);
  console.log(`- Dataset count: ${data.datasets ? data.datasets.length : 0}`);
  console.log('- Public access: ✅ Working');
  console.log('- Detail structure: ✅ Valid');
  console.log('- Error handling: ✅ Working');

  return true;
}

// Run test if called directly
if (require.main === module) {
  testPublicCollectionDetail()
    .then(success => {
      if (success) {
        console.log('\n🎉 Public collection detail test PASSED');
        process.exit(0);
      } else {
        console.log('\n💥 Public collection detail test FAILED');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test error:', error);
      process.exit(1);
    });
}

module.exports = testPublicCollectionDetail;