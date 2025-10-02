#!/usr/bin/env node

/**
 * Basic Collections List Test - Endpoint Tester V2 Framework
 *
 * Tests the /api/collections endpoint (GET) for basic functionality
 * This is a simple test to verify the endpoint returns a valid response
 */

const TestRunner = require('../../lib/TestRunner');
const chalk = require('chalk');

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

/**
 * Run basic collections list test
 */
async function runBasicCollectionsTest() {
  try {
    console.log(chalk.cyan('🧪 Testing Collections List Endpoint - Basic Test'));

    const result = await TestRunner
      .create(BASE_URL)
      .get('/api/collections')
      .withTimeout(10000)
      .expectStatus(200)
      .run();

    if (result.status === 'PASS') {
      console.log(chalk.green('✅ Collections list endpoint test passed'));

      // Basic validation
      const collections = result.response.body;
      if (Array.isArray(collections)) {
        console.log(chalk.green(`   📋 Returned ${collections.length} collections`));

        // Show detailed response data
        console.log(chalk.cyan('\n📄 Response Details:'));
        console.log(JSON.stringify(collections, null, 2));

        // Check first collection structure if any exist
        if (collections.length > 0) {
          console.log(chalk.cyan('\n🔍 First Collection Analysis:'));
          const firstCollection = collections[0];

          // Show all fields
          Object.keys(firstCollection).forEach(key => {
            const value = firstCollection[key];
            const type = typeof value;
            console.log(`   ${key}: ${value} (${type})`);
          });

          const hasRequiredFields =
            typeof firstCollection.id === 'number' &&
            typeof firstCollection.name === 'string' &&
            typeof firstCollection.isPublic === 'boolean';

          if (hasRequiredFields) {
            console.log(chalk.green('\n   ✅ Response structure is valid'));
          } else {
            console.log(chalk.yellow('\n   ⚠️  Response structure may be incomplete'));
          }
        }
      } else {
        console.log(chalk.yellow('   ⚠️  Response is not an array'));
        console.log(chalk.cyan('📄 Actual Response:'));
        console.log(JSON.stringify(collections, null, 2));
      }

      console.log(chalk.gray(`\n   ⏱️  Execution time: ${result.executionTime}ms`));
      return true;
    } else {
      console.log(chalk.red('❌ Collections list test failed'));
      console.log(chalk.red(`   Status: ${result.response.status}`));
      console.log(chalk.red(`   Errors: ${result.errors.join(', ')}`));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Test error: ${error.message}`));
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runBasicCollectionsTest().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(error => {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    process.exit(1);
  });
}

module.exports = {
  runBasicCollectionsTest
};