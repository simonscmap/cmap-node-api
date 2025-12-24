#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCSV, rowsToCSV } from './csv-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.dirname(__dirname);
const CSV_PATH = path.join(PROJECT_ROOT, 'estimation-tests.csv');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/api';
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const REQUEST_DELAY = 1000;

function buildApiConstraints(row) {
  const constraints = {};

  const spatial = {};
  if (row.c_latMin) spatial.latMin = parseFloat(row.c_latMin);
  if (row.c_latMax) spatial.latMax = parseFloat(row.c_latMax);
  if (row.c_lonMin) spatial.lonMin = parseFloat(row.c_lonMin);
  if (row.c_lonMax) spatial.lonMax = parseFloat(row.c_lonMax);

  if (row.c_depthMin) spatial.depthMin = parseFloat(row.c_depthMin);
  if (row.c_depthMax) spatial.depthMax = parseFloat(row.c_depthMax);

  if (Object.keys(spatial).length > 0) {
    constraints.spatial = spatial;
  }

  if (row.c_timeMin || row.c_timeMax) {
    constraints.temporal = {};
    if (row.c_timeMin) {
      constraints.temporal.startDate = row.c_timeMin.split('T')[0];
    }
    if (row.c_timeMax) {
      constraints.temporal.endDate = row.c_timeMax.split('T')[0];
    }
  }

  return constraints;
}

async function fetchRowCount(datasetName, constraints) {
  const url = `${API_BASE_URL}/collections/calculate-row-counts`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shortNames: [datasetName],
      constraints: constraints
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (data.results && data.results[datasetName] !== undefined) {
    return { success: true, rowCount: data.results[datasetName] };
  } else if (data.skipped && data.skipped.includes(datasetName)) {
    return { success: true, rowCount: null, skipped: true };
  } else if (data.failed && data.failed.includes(datasetName)) {
    return { success: false, error: 'Dataset calculation failed' };
  }

  throw new Error('Unexpected API response format');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: CSV not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const { headers, rows } = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));

  if (DRY_RUN) {
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!FORCE && row.rowCountQuery && row.rowCountQuery.trim() !== '') {
      continue;
    }

    try {
      const constraints = buildApiConstraints(row);
      const result = await fetchRowCount(row.dataset, constraints);

      if (result.skipped) {
        row.rowCountQuery = 'SKIPPED';
      } else if (result.success) {
        row.rowCountQuery = result.rowCount;
      } else {
        row.rowCountQuery = `ERROR: ${result.error}`;
      }
    } catch (err) {
      row.rowCountQuery = `ERROR: ${err.message}`;
    }

    fs.writeFileSync(CSV_PATH, rowsToCSV(headers, rows));

    if (i < rows.length - 1) {
      await sleep(REQUEST_DELAY);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
