/**
 * CatalogDbLoader - Download and cache SQLite catalog database
 * Handles downloading the catalog database from the API and caching it locally
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

class CatalogDbLoader {
  constructor(baseUrl = process.env.API_BASE_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.artifactsDir = path.join(__dirname, '..', 'artifacts');
    this.dbPath = path.join(this.artifactsDir, 'catalog.db');
  }

  /**
   * Load the database - download if needed or force rebuild
   * @param {Object} options - Configuration options
   * @param {boolean} options.forceRebuild - Force download even if cached
   * @returns {Promise<string>} Path to the database file
   */
  async loadDatabase(options = {}) {
    const { forceRebuild = false } = options;

    // Ensure artifacts directory exists
    if (!fs.existsSync(this.artifactsDir)) {
      fs.mkdirSync(this.artifactsDir, { recursive: true });
    }

    // Check if we need to download
    if (forceRebuild || !this.isCached()) {
      if (forceRebuild && this.isCached()) {
        console.log(chalk.yellow('  🔄 Force rebuild requested, deleting cached database...'));
        fs.unlinkSync(this.dbPath);
      }
      await this.downloadDatabase();
    } else {
      const stats = fs.statSync(this.dbPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(chalk.gray(`  ✓ Using cached database (${sizeInMB} MB)`));
    }

    return this.dbPath;
  }

  /**
   * Download the database from the API
   * @returns {Promise<string>} Path to the downloaded database
   */
  async downloadDatabase() {
    const endpoint = '/api/catalog/full-catalog-db';
    const url = new URL(endpoint, this.baseUrl).toString();

    console.log(chalk.cyan(`  ⬇️  Downloading catalog database from ${endpoint}...`));

    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 60000 // 60 second timeout for large file
      });

      // Create write stream
      const writer = fs.createWriteStream(this.dbPath);

      // Track download progress
      let downloadedBytes = 0;
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);

      response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const percentage = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          process.stdout.write(`\r  📦 Downloading... ${percentage}%`);
        }
      });

      // Pipe the response to the file
      response.data.pipe(writer);

      // Wait for download to complete
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const stats = fs.statSync(this.dbPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(chalk.green(`\n  ✅ Downloaded successfully (${sizeInMB} MB)`));

      return this.dbPath;

    } catch (error) {
      // Clean up partial download
      if (fs.existsSync(this.dbPath)) {
        fs.unlinkSync(this.dbPath);
      }

      if (error.response) {
        throw new Error(
          `Failed to download database: HTTP ${error.response.status} - ${error.response.statusText}`
        );
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to API at ${this.baseUrl}. Is the server running?`
        );
      } else {
        throw new Error(`Failed to download database: ${error.message}`);
      }
    }
  }

  /**
   * Get the path to the database file
   * @returns {string} Absolute path to catalog.db
   */
  getDatabasePath() {
    return this.dbPath;
  }

  /**
   * Check if the database is already cached
   * @returns {boolean} True if cached database exists
   */
  isCached() {
    return fs.existsSync(this.dbPath);
  }

  /**
   * Get information about the cached database
   * @returns {Object|null} Database info or null if not cached
   */
  getCacheInfo() {
    if (!this.isCached()) {
      return null;
    }

    const stats = fs.statSync(this.dbPath);
    return {
      path: this.dbPath,
      sizeBytes: stats.size,
      sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
      modifiedAt: stats.mtime,
      createdAt: stats.birthtime
    };
  }

  /**
   * Delete the cached database
   */
  clearCache() {
    if (this.isCached()) {
      fs.unlinkSync(this.dbPath);
      console.log(chalk.yellow('  🗑️  Cached database deleted'));
      return true;
    }
    return false;
  }
}

module.exports = CatalogDbLoader;
