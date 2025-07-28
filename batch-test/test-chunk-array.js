// Unit tests for chunkArray function
const { chunkArray } = require('../controllers/data/dropbox-vault/stagedParallelExecutor');

const runChunkArrayTests = () => {
  console.log('🧪 Running chunkArray unit tests');
  console.log('='.repeat(40));

  const testCases = [
    {
      name: 'Infinity string handling',
      array: [1, 2, 3, 4, 5],
      chunkSize: 'infinity',
      expected: [[1, 2, 3, 4, 5]]
    },
    {
      name: 'Infinity uppercase string handling',
      array: [1, 2, 3, 4, 5],
      chunkSize: 'INFINITY',
      expected: [[1, 2, 3, 4, 5]]
    },
    {
      name: '-1 numeric infinity handling',
      array: [1, 2, 3, 4, 5],
      chunkSize: -1,
      expected: [[1, 2, 3, 4, 5]]
    },
    {
      name: 'Chunk size equal to array length',
      array: [1, 2, 3, 4, 5],
      chunkSize: 5,
      expected: [[1, 2, 3, 4, 5]]
    },
    {
      name: 'Chunk size greater than array length',
      array: [1, 2, 3],
      chunkSize: 10,
      expected: [[1, 2, 3]]
    },
    {
      name: 'Normal numeric chunk size',
      array: [1, 2, 3, 4, 5, 6],
      chunkSize: 2,
      expected: [[1, 2], [3, 4], [5, 6]]
    },
    {
      name: 'Chunk size with remainder',
      array: [1, 2, 3, 4, 5],
      chunkSize: 2,
      expected: [[1, 2], [3, 4], [5]]
    },
    {
      name: 'String numeric chunk size',
      array: [1, 2, 3, 4],
      chunkSize: '2',
      expected: [[1, 2], [3, 4]]
    },
    {
      name: 'Single item chunks',
      array: [1, 2, 3],
      chunkSize: 1,
      expected: [[1], [2], [3]]
    }
  ];

  const errorTestCases = [
    {
      name: 'Invalid string chunk size',
      array: [1, 2, 3],
      chunkSize: 'invalid',
      shouldError: true
    },
    {
      name: 'Zero chunk size',
      array: [1, 2, 3],
      chunkSize: 0,
      shouldError: true
    },
    {
      name: 'Negative chunk size (not -1)',
      array: [1, 2, 3],
      chunkSize: -5,
      shouldError: true
    }
  ];

  let passed = 0;
  let total = 0;

  // Test normal cases
  testCases.forEach(testCase => {
    total++;
    console.log(`\n🔬 Testing: ${testCase.name}`);
    console.log(`   Input: array[${testCase.array.length}], chunkSize: ${testCase.chunkSize}`);
    
    try {
      const result = chunkArray(testCase.array, testCase.chunkSize);
      const resultStr = JSON.stringify(result);
      const expectedStr = JSON.stringify(testCase.expected);
      
      if (resultStr === expectedStr) {
        console.log(`   ✅ PASS - Result: ${resultStr}`);
        passed++;
      } else {
        console.log(`   ❌ FAIL`);
        console.log(`      Expected: ${expectedStr}`);
        console.log(`      Got:      ${resultStr}`);
      }
    } catch (error) {
      console.log(`   ❌ FAIL - Unexpected error: ${error.message}`);
    }
  });

  // Test error cases
  errorTestCases.forEach(testCase => {
    total++;
    console.log(`\n🔬 Testing: ${testCase.name} (should error)`);
    console.log(`   Input: array[${testCase.array.length}], chunkSize: ${testCase.chunkSize}`);
    
    try {
      const result = chunkArray(testCase.array, testCase.chunkSize);
      console.log(`   ❌ FAIL - Expected error but got result: ${JSON.stringify(result)}`);
    } catch (error) {
      console.log(`   ✅ PASS - Correctly threw error: ${error.message}`);
      passed++;
    }
  });

  console.log('\n' + '='.repeat(40));
  console.log(`📊 Test Results: ${passed}/${total} passed`);
  console.log(`📈 Success rate: ${Math.round((passed / total) * 100)}%`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
  } else {
    console.log(`💥 ${total - passed} tests failed`);
  }

  return passed === total;
};

if (require.main === module) {
  const success = runChunkArrayTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runChunkArrayTests };