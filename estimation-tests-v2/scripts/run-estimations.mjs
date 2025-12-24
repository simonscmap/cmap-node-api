#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { parseCSV, rowsToCSV } from './csv-utils.mjs';

import performRowCountMath from '../../cmap-react/src/features/rowCount/estimation/performRowCountMath.js';
import performRowCountMathV2 from '../../cmap-react/src/features/rowCount/estimation/performRowCountMathV2.js';
import performRowCountMathV3 from '../../cmap-react/src/features/rowCount/estimation/performRowCountMathV3.js';
import prepareRowCountInputsFromDatabase from '../../cmap-react/src/features/rowCount/estimation/prepareRowCountInputsFromDatabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.dirname(__dirname);
const CSV_PATH = path.join(PROJECT_ROOT, 'estimation-tests.csv');
const CATALOG_DB_PATH = path.join(PROJECT_ROOT, '..', 'catalog-db', 'catalog-latest.db');

const DRY_RUN = process.argv.includes('--dry-run');

function executeSql(sql, bindings = []) {
  let boundSql = sql;
  for (const value of bindings) {
    if (value === null || value === undefined) {
      boundSql = boundSql.replace('?', 'NULL');
    } else if (typeof value === 'number') {
      boundSql = boundSql.replace('?', String(value));
    } else {
      boundSql = boundSql.replace('?', `'${String(value).replace(/'/g, "''")}'`);
    }
  }

  try {
    const result = execSync(
      `sqlite3 -json "${CATALOG_DB_PATH}" "${boundSql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    return result.trim() ? JSON.parse(result) : [];
  } catch {
    return [];
  }
}

const catalogDb = {
  executeSql: async (sql, bindings) => executeSql(sql, bindings)
};

function buildMetadata(row) {
  return {
    shortName: row.dataset,
    spatialResolution: row.spatialResolution,
    temporalResolution: row.temporalResolution,
    hasDepth: row.hasDepth.toLowerCase() === 'true',
    latMin: row.latMin ? +row.latMin : null,
    latMax: row.latMax ? +row.latMax : null,
    lonMin: row.lonMin ? +row.lonMin : null,
    lonMax: row.lonMax ? +row.lonMax : null,
    timeMin: row.timeMin || null,
    timeMax: row.timeMax || null,
    depthMin: row.depthMin ? +row.depthMin : null,
    depthMax: row.depthMax ? +row.depthMax : null,
    tableCount: row.tableCount ? +row.tableCount : 1,
  };
}

function buildConstraints(row) {
  return {
    spatialBounds: { latMin: +row.c_latMin, latMax: +row.c_latMax, lonMin: +row.c_lonMin, lonMax: +row.c_lonMax },
    temporalEnabled: !!(row.c_timeMin && row.c_timeMax),
    temporalRange: { timeMin: row.c_timeMin || null, timeMax: row.c_timeMax || null },
    depthEnabled: !!(row.c_depthMin && row.c_depthMax),
    depthRange: { depthMin: row.c_depthMin ? +row.c_depthMin : null, depthMax: row.c_depthMax ? +row.c_depthMax : null },
  };
}

async function main() {
  if (!fs.existsSync(CATALOG_DB_PATH)) {
    console.error(`Error: Database not found: ${CATALOG_DB_PATH}`);
    process.exit(1);
  }

  const { headers, rows } = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));

  if (DRY_RUN) {
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      const inputs = await prepareRowCountInputsFromDatabase(
        buildMetadata(row),
        buildConstraints(row),
        catalogDb
      );
      const constraints = buildConstraints(row);

      const v1 = performRowCountMath(inputs, constraints);
      const v2 = performRowCountMathV2(inputs, constraints);
      const v3 = performRowCountMathV3(inputs, constraints);

      row.estimatedRowCount = v1;
      row.estimatedRowCountV2 = v2;
      row.estimatedRowCountV3 = v3;
    } catch (err) {
    }

    fs.writeFileSync(CSV_PATH, rowsToCSV(headers, rows));
  }
}

main();
