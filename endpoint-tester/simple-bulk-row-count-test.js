#!/usr/bin/env node

const fetch = require('isomorphic-fetch');

const BASE_URL = 'http://localhost:8080';

async function testBulkRowCounts() {
  const shortNames = [
    'Gradients5_TN412_Hyperpro_Profiles',
    'Gradients5_TN412_FluorometricChlorophyll_UW',
    'Gradients5_TN412_FluorometricChlorophyll_CTD',
  ];

  // Initial filters
  const initialFilters = {
    temporal: {
      startDate: '2023-06-01',
      endDate: '2023-08-31',
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
      startDate: '2023-06-01',
      endDate: '2023-07-31',
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
      startDate: '2023-06-01',
      endDate: '2023-09-31',
    },
    spatial: {
      latMin: 10,
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

  try {
    console.log('Testing Initial Filters...', initialFilters);
    const initial = await makeRequest(initialFilters);
    console.log('Initial response:', initial);
    const initialTotal = Object.values(initial).reduce(
      (sum, count) => sum + count,
      0,
    );
    console.log(`Initial: ${initialTotal} total rows`);

    console.log('Testing Narrowed Filters...', narrowedFilters);
    const narrowed = await makeRequest(narrowedFilters);
    console.log('Narrowed response:', narrowed);
    const narrowedTotal = Object.values(narrowed).reduce(
      (sum, count) => sum + count,
      0,
    );
    console.log(`Narrowed: ${narrowedTotal} total rows`);

    console.log('Testing Expanded Filters...', expandedFilters);
    const expanded = await makeRequest(expandedFilters);
    console.log('Expanded response:', expanded);
    // const expandedTotal = Object.values(expanded).reduce(
    //   (sum, count) => sum + count,
    //   0,
    // );
    // console.log(`Expanded: ${expandedTotal} total rows`);

    // console.log('\nResults:');
    // console.log(
    //   `Initial → Narrowed: ${narrowedTotal - initialTotal} (${
    //     narrowedTotal < initialTotal ? 'decreased ✓' : 'not decreased ✗'
    //   })`,
    // );
    // console.log(
    //   `Initial → Expanded: ${expandedTotal - initialTotal} (${
    //     expandedTotal > initialTotal ? 'increased ✓' : 'not increased ✗'
    //   })`,
    // );
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testBulkRowCounts();
