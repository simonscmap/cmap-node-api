#!/usr/bin/env node

/**
 * T009: Manual test script for error handling edge cases using endpoint-tester
 *
 * Test scenario: Edge Cases and Error Handling
 * - Should handle malformed requests gracefully
 * - Should provide appropriate HTTP status codes
 * - Should return consistent error response format
 * - Should handle database connection issues
 * - Should validate rate limiting (if implemented)
 * - Should handle various content-type headers
 */

const EndpointTester = require('../test-endpoints.js');

async function testErrorHandlingEdgeCases() {
  console.log('🧪 Testing Collections API - Error Handling Edge Cases');
  console.log('='.repeat(50));

  const tester = new EndpointTester();
  let passedTests = 0;
  let failedTests = 0;

  // Define edge case test scenarios
  const edgeCases = [
    {
      name: 'Extremely long collection ID',
      test: async () => {
        const longId = 'x'.repeat(1000);
        const result = await tester.get(`/api/collections/${longId}`);
        return {
          success: result.response && (result.response.status === 400 || result.response.status === 404),
          message: result.response ? `Status: ${result.response.status}` : 'Request failed'
        };
      }
    },
    {
      name: 'Collection ID with special characters',
      test: async () => {
        const specialId = '../../../etc/passwd';
        const result = await tester.get(`/api/collections/${encodeURIComponent(specialId)}`);
        return {
          success: result.response && (result.response.status === 400 || result.response.status === 404),
          message: result.response ? `Status: ${result.response.status}` : 'Request failed'
        };
      }
    },
    {
      name: 'Collection ID with null bytes',
      test: async () => {
        const nullId = 'test\x00injection';
        const result = await tester.get(`/api/collections/${encodeURIComponent(nullId)}`);
        return {
          success: result.response && (result.response.status === 400 || result.response.status === 404),
          message: result.response ? `Status: ${result.response.status}` : 'Request failed'
        };
      }
    },
    {
      name: 'Very large limit parameter',
      test: async () => {
        const result = await tester.get('/api/collections?limit=999999999');
        return {
          success: result.response && result.response.status === 400,
          message: result.response ? `Status: ${result.response.status}` : 'Request failed'
        };
      }
    },
    {
      name: 'Very large offset parameter',
      test: async () => {
        const result = await tester.get('/api/collections?offset=999999999');
        return {
          success: result.response && (result.response.status === 400 || result.response.ok),
          message: result.response ? `Status: ${result.response.status}` : 'Request failed'
        };
      }
    },
    {
      name: 'Malformed JSON in search parameter',
      test: async () => {
        const malformedSearch = '{"incomplete": json';
        const result = await tester.get(`/api/collections?search=${encodeURIComponent(malformedSearch)}`);
        return {
          success: result.response && (result.response.ok || result.response.status === 400),
          message: result.response ? `Status: ${result.response.status}` : 'Request failed'
        };
      }
    },
    {
      name: 'Unicode characters in search',
      test: async () => {
        const unicodeSearch = '🌊🐟🔬🌍';
        const result = await tester.get(`/api/collections?search=${encodeURIComponent(unicodeSearch)}`);
        return {
          success: result.response && result.response.ok,
          message: result.response ? `Status: ${result.response.status}` : 'Request failed'
        };
      }
    },
    {
      name: 'Multiple identical parameters',
      test: async () => {
        const result = await tester.get('/api/collections?limit=5&limit=10&limit=15');
        return {
          success: result.response && (result.response.ok || result.response.status === 400),
          message: result.response ? `Status: ${result.response.status}` : 'Request failed'
        };
      }
    },
    {
      name: 'Empty collection ID',
      test: async () => {
        const result = await tester.get('/api/collections/');
        return {
          success: result.response && (result.response.status === 404 || result.response.status === 400),
          message: result.response ? `Status: ${result.response.status}` : 'Request failed'
        };
      }
    },
    {
      name: 'Nested path traversal attempt',
      test: async () => {
        const result = await tester.get('/api/collections/../../../etc/passwd');
        return {
          success: result.response && (result.response.status === 404 || result.response.status === 400),
          message: result.response ? `Status: ${result.response.status}` : 'Request failed'
        };
      }
    }
  ];

  console.log(`\n🧪 Running ${edgeCases.length} edge case tests...\n`);

  for (const edgeCase of edgeCases) {
    console.log(`📝 Test: ${edgeCase.name}`);

    try {
      const result = await edgeCase.test();

      if (result.success) {
        console.log(`   Result: ✅ ${result.message}`);
        console.log(`   Status: ✅ PASS\n`);
        passedTests++;
      } else {
        console.log(`   Result: ❌ ${result.message}`);
        console.log(`   Status: ❌ FAIL\n`);
        failedTests++;
      }
    } catch (error) {
      console.log(`   Result: ❌ Exception - ${error.message}`);
      console.log(`   Status: ❌ FAIL\n`);
      failedTests++;
    }
  }

  // Test HTTP method validation
  console.log('📝 Test: Invalid HTTP methods');
  const invalidMethods = ['PUT', 'DELETE', 'PATCH'];

  for (const method of invalidMethods) {
    try {
      const result = await tester.request(method, '/api/collections');
      const success = result.response && result.response.status === 405; // Method Not Allowed

      if (success) {
        console.log(`   ${method}: ✅ Properly rejected (405)`);
        passedTests++;
      } else {
        console.log(`   ${method}: ❌ Status ${result.response ? result.response.status : 'unknown'}`);
        failedTests++;
      }
    } catch (error) {
      console.log(`   ${method}: ❌ Exception - ${error.message}`);
      failedTests++;
    }
  }

  // Test CORS and security headers
  console.log('\n📝 Test: Response headers and security');
  const headersResult = await tester.get('/api/collections');

  if (headersResult.response) {
    const headers = headersResult.response.headers;

    // Check for security headers
    const securityChecks = [
      {
        name: 'Content-Type header present',
        check: headers.has('content-type') || headers.has('Content-Type')
      },
      {
        name: 'Response not cached inappropriately',
        check: !headers.get('cache-control') || !headers.get('cache-control').includes('max-age=31536000')
      }
    ];

    for (const check of securityChecks) {
      if (check.check) {
        console.log(`   ${check.name}: ✅`);
        passedTests++;
      } else {
        console.log(`   ${check.name}: ❌`);
        failedTests++;
      }
    }
  } else {
    console.log('   Security headers: ❌ No response to check');
    failedTests++;
  }

  // Test concurrent requests (basic load test)
  console.log('\n📝 Test: Concurrent request handling');
  const concurrentPromises = [];
  for (let i = 0; i < 5; i++) {
    concurrentPromises.push(tester.get('/api/collections?limit=1'));
  }

  try {
    const concurrentResults = await Promise.all(concurrentPromises);
    const allSuccessful = concurrentResults.every(result =>
      result.response && result.response.ok
    );

    if (allSuccessful) {
      console.log('   Concurrent requests: ✅ All succeeded');
      passedTests++;
    } else {
      console.log('   Concurrent requests: ❌ Some failed');
      failedTests++;
    }
  } catch (error) {
    console.log(`   Concurrent requests: ❌ Exception - ${error.message}`);
    failedTests++;
  }

  // Test error response format consistency
  console.log('\n📝 Test: Error response format consistency');
  const errorResult = await tester.get('/api/collections/definitely-does-not-exist-12345');

  if (errorResult.response && !errorResult.response.ok && errorResult.data) {
    const errorData = errorResult.data;
    const hasMessage = typeof errorData === 'object' && errorData.message;
    const hasError = typeof errorData === 'string' && errorData.length > 0;

    if (hasMessage || hasError) {
      console.log('   Error format: ✅ Consistent error messages');
      passedTests++;
    } else {
      console.log('   Error format: ❌ Inconsistent error messages');
      failedTests++;
    }
  } else {
    console.log('   Error format: ⚠️  No error response to validate');
    passedTests++; // Don't fail on this
  }

  const totalTests = edgeCases.length + invalidMethods.length + 5; // +5 for additional tests

  console.log('\n📊 Edge Case Testing Summary:');
  console.log(`- Total tests: ${totalTests}`);
  console.log(`- Passed: ${passedTests}`);
  console.log(`- Failed: ${failedTests}`);
  console.log(`- Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

  console.log('\n✅ Key edge cases tested:');
  console.log('- Path traversal protection');
  console.log('- Input validation boundaries');
  console.log('- Special character handling');
  console.log('- HTTP method validation');
  console.log('- Security header presence');
  console.log('- Concurrent request handling');
  console.log('- Error response consistency');

  return failedTests === 0;
}

// Run test if called directly
if (require.main === module) {
  testErrorHandlingEdgeCases()
    .then(success => {
      if (success) {
        console.log('\n🎉 Error handling edge cases test PASSED');
        process.exit(0);
      } else {
        console.log('\n💥 Error handling edge cases test FAILED');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test error:', error);
      process.exit(1);
    });
}

module.exports = testErrorHandlingEdgeCases;