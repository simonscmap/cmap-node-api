#!/usr/bin/env node

const fetch = require('isomorphic-fetch');

const BASE_URL = 'http://localhost:8080';

async function testBulkRowCounts() {
  const shortNames = [
    'Gradients5_TN412_Hyperpro_Profiles',
    'Gradients5_TN412_FluorometricChlorophyll_UW',
    'Gradients5_TN412_FluorometricChlorophyll_CTD',
  ];

  // Expected row counts
  const expectedInitial = {
    Gradients5_TN412_Hyperpro_Profiles: 34,
    Gradients5_TN412_FluorometricChlorophyll_UW: 17,
    Gradients5_TN412_FluorometricChlorophyll_CTD: 2,
  };

  const expectedNarrowed = {
    Gradients5_TN412_Hyperpro_Profiles: 0,
    Gradients5_TN412_FluorometricChlorophyll_UW: 3,
    Gradients5_TN412_FluorometricChlorophyll_CTD: 0,
  };

  const expectedExpanded = {
    Gradients5_TN412_Hyperpro_Profiles: 258,
    Gradients5_TN412_FluorometricChlorophyll_UW: 37,
    Gradients5_TN412_FluorometricChlorophyll_CTD: 15,
  };

  // Initial filters
  const initialFilters = {
    temporal: {
      startDate: '2023-01-26',
      endDate: '2023-01-31',
    },
    spatial: {
      latMin: 10,
      latMax: 40,
      lonMin: -140,
      lonMax: -120,
    },
    depth: {
      min: 0,
      max: 20,
    },
  };

  // Narrowed filters
  const narrowedFilters = {
    temporal: {
      startDate: '2023-01-26',
      endDate: '2023-01-27',
    },
    spatial: {
      latMin: 10,
      latMax: 40,
      lonMin: -140,
      lonMax: -120,
    },
    depth: {
      min: 0,
      max: 10,
    },
  };

  // Expanded filters
  const expandedFilters = {
    temporal: {
      startDate: '2023-01-16',
      endDate: '2023-02-11',
    },
    spatial: {
      latMin: 0,
      latMax: 40,
      lonMin: -140,
      lonMax: -120,
    },
    depth: {
      min: 0,
      max: 50,
    },
  };

  async function makeRequest(filters) {
    const formData = new URLSearchParams();
    formData.append('shortNames', JSON.stringify(shortNames));
    formData.append('filters', JSON.stringify(filters));

    const response = await fetch(
      `${BASE_URL}/api/data/bulk-download-row-counts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.message || data.error);
    }

    return data;
  }

  function checkResults(actual, expected, testName) {
    let allMatch = true;
    console.log(`\n📋 ${testName}`);

    for (const dataset of shortNames) {
      const actualCount = actual[dataset] || 0;
      const expectedCount = expected[dataset] || 0;
      const match = actualCount === expectedCount;
      allMatch = allMatch && match;

      console.log(`   ${dataset}: ${actualCount} ${match ? '✅' : '❌'}`);
      if (!match) {
        console.log(`      Expected: ${expectedCount}, Got: ${actualCount}`);
      }
    }

    const actualTotal = Object.values(actual).reduce(
      (sum, count) => sum + count,
      0,
    );
    const expectedTotal = Object.values(expected).reduce(
      (sum, count) => sum + count,
      0,
    );
    console.log(
      `   Total: ${actualTotal} ${actualTotal === expectedTotal ? '✅' : '❌'}`,
    );

    return allMatch;
  }

  try {
    console.log('🧪 Testing Bulk Row Count Endpoint');

    const initial = await makeRequest(initialFilters);
    const initialPass = checkResults(
      initial,
      expectedInitial,
      'Initial Filters',
    );

    const narrowed = await makeRequest(narrowedFilters);
    const narrowedPass = checkResults(
      narrowed,
      expectedNarrowed,
      'Narrowed Filters',
    );

    const expanded = await makeRequest(expandedFilters);
    const expandedPass = checkResults(
      expanded,
      expectedExpanded,
      'Expanded Filters',
    );

    console.log(
      `\n🏁 Test complete: ${
        initialPass && narrowedPass && expandedPass
          ? '✅ All tests passed'
          : '❌ Some tests failed'
      }`,
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBulkRowCounts();
