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

const REQUEST_DELAY = 2000;

const REQUEST_TIMEOUT = 4 * 60 * 60 * 1000;

function buildApiFilters(row) {
  const filters = {};

  const spatial = {};
  if (row.c_latMin) spatial.latMin = parseFloat(row.c_latMin);
  if (row.c_latMax) spatial.latMax = parseFloat(row.c_latMax);
  if (row.c_lonMin) spatial.lonMin = parseFloat(row.c_lonMin);
  if (row.c_lonMax) spatial.lonMax = parseFloat(row.c_lonMax);

  if (row.c_depthMin) spatial.depthMin = parseFloat(row.c_depthMin);
  if (row.c_depthMax) spatial.depthMax = parseFloat(row.c_depthMax);

  if (Object.keys(spatial).length > 0) {
    filters.spatial = spatial;
  }

  if (row.c_timeMin || row.c_timeMax) {
    filters.temporal = {};
    if (row.c_timeMin) {
      filters.temporal.startDate = row.c_timeMin.split('T')[0];
    }
    if (row.c_timeMax) {
      filters.temporal.endDate = row.c_timeMax.split('T')[0];
    }
  }

  return filters;
}

async function fetchBulkDownloadRowCount(datasetName, filters) {
  const url = `${API_BASE_URL}/data/bulk-download`;

  const headers = {
    'Content-Type': 'application/json',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        shortNames: [datasetName],
        filters: Object.keys(filters).length > 0 ? filters : undefined
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.rowCounts && Array.isArray(data.rowCounts) && data.rowCounts[0]) {
      const tableResults = data.rowCounts[0][1];
      if (Array.isArray(tableResults)) {
        const totalRowCount = tableResults.reduce((sum, t) => sum + (t.count || 0), 0);
        return { success: true, rowCount: totalRowCount };
      }
    }

    return { success: false, error: `Unexpected response: ${JSON.stringify(data)}` };

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT / 1000} seconds`);
    }
    throw err;
  }
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

    if (!FORCE && row.rowCountDownload && row.rowCountDownload.trim() !== '') {
      continue;
    }

    try {
      const filters = buildApiFilters(row);
      const result = await fetchBulkDownloadRowCount(row.dataset, filters);

      if (result.success) {
        row.rowCountDownload = result.rowCount;
      } else {
        row.rowCountDownload = `ERROR: ${result.error}`;
      }
    } catch (err) {
      row.rowCountDownload = `ERROR: ${err.message}`;
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
