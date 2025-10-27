#!/usr/bin/env node

/**
 * Test script to download and inspect the catalog database
 * Usage: node scripts/test-catalog-db.js
 */

const http = require('http');
const zlib = require('zlib');
const Database = require('better-sqlite3');
const fs = require('fs');

console.log('Fetching catalog database from API...\n');

http.get('http://localhost:8080/api/catalog/full-catalog-db', (res) => {
  const chunks = [];

  res.on('data', (chunk) => {
    chunks.push(chunk);
  });

  res.on('end', () => {
    console.log('Download complete. Decompressing...\n');

    const gzippedBuffer = Buffer.concat(chunks);
    const dbBuffer = zlib.gunzipSync(gzippedBuffer);

    console.log(`Database size: ${(dbBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`Compressed size: ${(gzippedBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`Compression ratio: ${((1 - gzippedBuffer.length / dbBuffer.length) * 100).toFixed(1)}%\n`);

    // Save to file
    const outputPath = './catalog.db';
    fs.writeFileSync(outputPath, dbBuffer);
    console.log(`Database saved to: ${outputPath}\n`);

    // Open and inspect
    const db = new Database(outputPath);

    console.log('=== DATABASE INSPECTION ===\n');

    // Count datasets
    const count = db.prepare('SELECT COUNT(*) as count FROM datasets').get();
    console.log(`Total datasets: ${count.count}\n`);

    // Show first 5 datasets
    console.log('First 5 datasets:');
    console.log('─'.repeat(80));
    const datasets = db.prepare('SELECT datasetId, shortName, longName FROM datasets LIMIT 5').all();
    datasets.forEach((d) => {
      console.log(`[${d.datasetId}] ${d.shortName}`);
      console.log(`    ${d.longName}`);
    });
    console.log();

    // Test FTS search
    console.log('Testing FTS search for "ocean":');
    console.log('─'.repeat(80));
    const searchResults = db.prepare(`
      SELECT d.datasetId, d.shortName, d.longName
      FROM datasets d
      JOIN datasets_fts fts ON d.datasetId = fts.rowid
      WHERE fts MATCH 'ocean'
      LIMIT 5
    `).all();

    searchResults.forEach((d) => {
      console.log(`[${d.datasetId}] ${d.shortName}`);
      console.log(`    ${d.longName}`);
    });
    console.log();

    // Show table info
    console.log('Database schema:');
    console.log('─'.repeat(80));
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', tables.map(t => t.name).join(', '));

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
    console.log('Indexes:', indexes.map(i => i.name).join(', '));
    console.log();

    // Sample dataset with all fields
    console.log('Sample dataset (all fields):');
    console.log('─'.repeat(80));
    const sample = db.prepare('SELECT * FROM datasets LIMIT 1').get();
    Object.keys(sample).forEach((key) => {
      let value = sample[key];
      if (typeof value === 'string' && value.length > 100) {
        value = value.substring(0, 100) + '...';
      }
      console.log(`${key}: ${value}`);
    });

    db.close();

    console.log('\n✅ Inspection complete!');
    console.log(`\nTo explore further, run: sqlite3 ${outputPath}`);
  });
}).on('error', (err) => {
  console.error('Error fetching database:', err.message);
  process.exit(1);
});
