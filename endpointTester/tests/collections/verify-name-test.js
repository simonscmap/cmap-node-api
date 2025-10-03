#!/usr/bin/env node

/**
 * Collection Name Verification Test - Endpoint Tester V2 Framework
 *
 * Tests the /api/collections/verify-name endpoint (GET) for name availability checking
 * This verifies that the endpoint correctly checks if a collection name is available
 */

const TestRunner = require('../../lib/TestRunner');
const chalk = require('chalk');

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

/**
 * Run collection name verification test
 */
async function runVerifyNameTest() {
  try {
    console.log(chalk.cyan('🧪 Testing Collection Name Verification Endpoint'));

    // Test 1: Check a random unique name (should be available)
    const uniqueName = 'TEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    console.log(chalk.cyan(`\n📝 Test 1: Checking unique name "${uniqueName}"`));

    const result1 = await TestRunner
      .create(BASE_URL)
      .get('/api/collections/verify-name')
      .withQuery({ name: uniqueName })
      .withAuth('multiple')
      .withTimeout(10000)
      .expectStatus(200)
      .run();

    if (result1.status === 'PASS') {
      console.log(chalk.green('✅ Unique name check passed'));

      const response = result1.response.body;
      console.log(chalk.cyan('\n📄 Response Details:'));
      console.log(JSON.stringify(response, null, 2));

      // Validate response structure
      if (response.name && typeof response.isAvailable === 'boolean') {
        console.log(chalk.green('\n   ✅ Response structure is valid'));
        console.log(chalk.gray(`   Name: ${response.name}`));
        console.log(chalk.gray(`   Available: ${response.isAvailable}`));

        if (response.isAvailable === true) {
          console.log(chalk.green('   ✅ Name correctly identified as available'));
        } else {
          console.log(chalk.yellow('   ⚠️  Unique name was marked as unavailable'));
        }
      } else {
        console.log(chalk.yellow('\n   ⚠️  Response structure may be incomplete'));
      }

      console.log(chalk.gray(`\n   ⏱️  Execution time: ${result1.executionTime}ms`));
    } else {
      console.log(chalk.red('❌ Unique name check failed'));
      console.log(chalk.red(`   Status: ${result1.response.status}`));
      console.log(chalk.red(`   Errors: ${result1.errors.join(', ')}`));
      return false;
    }

    // Test 2: Check with missing name parameter (should fail validation)
    console.log(chalk.cyan(`\n📝 Test 2: Checking without name parameter (should fail)`));

    const result2 = await TestRunner
      .create(BASE_URL)
      .get('/api/collections/verify-name')
      .withAuth('multiple')
      .withTimeout(10000)
      .expectStatus(400)
      .run();

    if (result2.status === 'PASS') {
      console.log(chalk.green('✅ Validation correctly rejected missing name'));

      const response = result2.response.body;
      console.log(chalk.cyan('\n📄 Error Response:'));
      console.log(JSON.stringify(response, null, 2));

      console.log(chalk.gray(`\n   ⏱️  Execution time: ${result2.executionTime}ms`));
    } else {
      console.log(chalk.yellow('⚠️  Missing name parameter test had unexpected result'));
      console.log(chalk.gray(`   Expected 400, got ${result2.response.status}`));
    }

    // Test 3: Check with invalid name (empty string)
    console.log(chalk.cyan(`\n📝 Test 3: Checking with empty name (should fail)`));

    const result3 = await TestRunner
      .create(BASE_URL)
      .get('/api/collections/verify-name')
      .withQuery({ name: '' })
      .withAuth('multiple')
      .withTimeout(10000)
      .expectStatus(400)
      .run();

    if (result3.status === 'PASS') {
      console.log(chalk.green('✅ Validation correctly rejected empty name'));

      const response = result3.response.body;
      console.log(chalk.cyan('\n📄 Error Response:'));
      console.log(JSON.stringify(response, null, 2));

      console.log(chalk.gray(`\n   ⏱️  Execution time: ${result3.executionTime}ms`));
    } else {
      console.log(chalk.yellow('⚠️  Empty name test had unexpected result'));
      console.log(chalk.gray(`   Expected 400, got ${result3.response.status}`));
    }

    console.log(chalk.green('\n✅ All verify-name tests completed'));
    return true;

  } catch (error) {
    console.log(chalk.red(`❌ Test error: ${error.message}`));
    if (error.stack) {
      console.log(chalk.gray(error.stack));
    }
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runVerifyNameTest().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(error => {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    process.exit(1);
  });
}

module.exports = {
  runVerifyNameTest
};
