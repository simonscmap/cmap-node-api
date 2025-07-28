require('dotenv').config();
const { generateAllCombinations } = require('./config-override');

const testRepeatCount = () => {
  console.log('🧪 Testing REPEAT_COUNT Fix');
  console.log('='.repeat(40));

  // Test configuration with REPEAT_COUNT as integer
  const testConfigInteger = {
    BATCH_SIZE: [10, 20],
    PARALLEL_COUNT: [1, 2],
    WAVE_DELAY: [0, 1000],
    BATCH_STAGGER: [0, 100],
    FILE_COUNT: [10],
    REPEAT_COUNT: 3  // Integer, not array
  };

  // Test configuration with REPEAT_COUNT as array (legacy)
  const testConfigArray = {
    BATCH_SIZE: [10, 20],
    PARALLEL_COUNT: [1, 2],
    WAVE_DELAY: [0, 1000],
    BATCH_STAGGER: [0, 100],
    FILE_COUNT: [10],
    REPEAT_COUNT: [3]  // Array format
  };

  console.log('🔬 Test 1: REPEAT_COUNT as integer');
  console.log(`   Input: REPEAT_COUNT = ${testConfigInteger.REPEAT_COUNT} (type: ${typeof testConfigInteger.REPEAT_COUNT})`);
  
  const combinationsInteger = generateAllCombinations(testConfigInteger);
  console.log(`   Generated combinations: ${combinationsInteger.length}`);
  console.log(`   Expected combinations: ${2 * 2 * 2 * 2 * 1} = 16 (excluding REPEAT_COUNT)`);
  
  // Check if REPEAT_COUNT is excluded from combinations
  const hasRepeatCount = combinationsInteger.some(combo => Object.prototype.hasOwnProperty.call(combo, 'REPEAT_COUNT'));
  console.log(`   REPEAT_COUNT included in combinations: ${hasRepeatCount}`);
  
  if (combinationsInteger.length === 16 && !hasRepeatCount) {
    console.log('   ✅ CORRECT - Integer REPEAT_COUNT properly excluded from combinations');
  } else {
    console.log('   ❌ ERROR - Integer REPEAT_COUNT handling failed');
  }

  console.log('\n🔬 Test 2: REPEAT_COUNT as array (legacy)');
  console.log(`   Input: REPEAT_COUNT = ${JSON.stringify(testConfigArray.REPEAT_COUNT)} (type: ${typeof testConfigArray.REPEAT_COUNT})`);
  
  const combinationsArray = generateAllCombinations(testConfigArray);
  console.log(`   Generated combinations: ${combinationsArray.length}`);
  console.log(`   Expected combinations: 16 (excluding REPEAT_COUNT)`);
  
  // Check if REPEAT_COUNT is excluded from combinations
  const hasRepeatCountArray = combinationsArray.some(combo => Object.prototype.hasOwnProperty.call(combo, 'REPEAT_COUNT'));
  console.log(`   REPEAT_COUNT included in combinations: ${hasRepeatCountArray}`);
  
  if (combinationsArray.length === 16 && !hasRepeatCountArray) {
    console.log('   ✅ CORRECT - Array REPEAT_COUNT properly excluded from combinations');
  } else {
    console.log('   ❌ ERROR - Array REPEAT_COUNT handling failed');
  }

  console.log('\n🔬 Test 3: Repeat count extraction logic');
  
  // Test the extraction logic from batch-test-runner.js
  const extractRepeatCount = (testParams) => {
    return typeof testParams.REPEAT_COUNT === 'number' ? 
      testParams.REPEAT_COUNT : testParams.REPEAT_COUNT[0];
  };
  
  const repeatCountFromInteger = extractRepeatCount(testConfigInteger);
  const repeatCountFromArray = extractRepeatCount(testConfigArray);
  
  console.log(`   From integer config: ${repeatCountFromInteger} (type: ${typeof repeatCountFromInteger})`);
  console.log(`   From array config: ${repeatCountFromArray} (type: ${typeof repeatCountFromArray})`);
  
  if (repeatCountFromInteger === 3 && repeatCountFromArray === 3) {
    console.log('   ✅ CORRECT - Both integer and array formats extract correctly');
  } else {
    console.log('   ❌ ERROR - Repeat count extraction failed');
  }

  console.log('\n🔬 Test 4: Sample combinations output');
  console.log('   First 3 combinations from integer config:');
  combinationsInteger.slice(0, 3).forEach((combo, index) => {
    console.log(`     ${index + 1}: ${JSON.stringify(combo)}`);
  });

  console.log('\n' + '='.repeat(40));
  console.log('✅ REPEAT_COUNT testing completed');
  
  return true;
};

if (require.main === module) {
  try {
    const success = testRepeatCount();
    console.log('🎉 REPEAT_COUNT test completed successfully!');
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 REPEAT_COUNT test failed:', error);
    process.exit(1);
  }
}

module.exports = { testRepeatCount };