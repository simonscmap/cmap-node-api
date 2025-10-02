#!/usr/bin/env node

const fetch = require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Download directory configuration
const DOWNLOAD_DIR = '/Users/howardwkim/Downloads';

class EndpointTester {
  constructor(baseUrl = 'http://localhost:8080', downloadDir = DOWNLOAD_DIR) {
    this.baseUrl = baseUrl;
    this.downloadDir = downloadDir;
    this.jwt = null;
  }

  async login(username, password) {
    // Use native http module to get all Set-Cookie headers
    return new Promise((resolve) => {
      const url = new URL(`${this.baseUrl}/api/user/signin`);
      const postData = JSON.stringify({ username, password });

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            // Get all Set-Cookie headers
            const setCookieHeaders = res.headers['set-cookie'] || [];

            // Look for JWT cookie
            for (const cookieString of setCookieHeaders) {
              const jwtMatch = cookieString.match(/jwt=([^;]+)/);
              if (jwtMatch) {
                this.jwt = jwtMatch[1];
                console.log('✅ Login successful - JWT token saved');
                resolve(true);
                return;
              }
            }

            console.log('⚠️  Login response OK but no JWT cookie found');
            resolve(false);
          } else {
            console.log('❌ Login failed - status:', res.statusCode);
            console.log('❌ Response:', data);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.log('❌ Login error:', err.message);
        resolve(false);
      });

      req.write(postData);
      req.end();
    });
  }

  async request(method, urlPath, body = null, options = {}) {
    const url = `${this.baseUrl}${urlPath}`;
    const headers = {};

    // Handle different content types
    if (options.formData) {
      // For form data, set the correct content type
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      // Convert body object to URLSearchParams for form data
      const formBody = new URLSearchParams();
      if (body) {
        Object.keys(body).forEach((key) => {
          const value =
            typeof body[key] === 'object'
              ? JSON.stringify(body[key])
              : body[key];
          formBody.append(key, value);
        });
      }
      body = formBody.toString();
    } else {
      headers['Content-Type'] = 'application/json';
      if (body) {
        body = JSON.stringify(body);
      }
    }

    // Add JWT cookie if we have one
    if (this.jwt) {
      headers['Cookie'] = `jwt=${this.jwt}`;
    }

    console.log(`\n📡 ${method} ${urlPath}`);
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body,
      });

      const duration = Date.now() - startTime;
      const statusIcon = response.ok ? '✅' : '❌';

      console.log(
        `${statusIcon} ${response.status} ${response.statusText} (${duration}ms)`,
      );

      // Check if response is a file download
      const contentType = response.headers.get('content-type') || '';
      const contentDisposition =
        response.headers.get('content-disposition') || '';


      // Detect binary file downloads by content type or disposition
      const isBinaryFile =
        contentType.includes('application/zip') ||
        contentType.includes('application/octet-stream') ||
        contentType.includes('application/x-zip') ||
        contentDisposition.includes('attachment') ||
        // If content type is not text/html or application/json, likely a file
        (contentType &&
          !contentType.includes('text/') &&
          !contentType.includes('application/json'));

      if (isBinaryFile) {

        if (response.ok) {
          // Extract filename from content-disposition or use default
          let filename = 'download.zip';
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(
              /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
            );
            if (filenameMatch) {
              filename = filenameMatch[1].replace(/['"]/g, '');
            }
          }

          // Save file to configured download directory
          const buffer = await response.buffer();
          const filePath = path.join(this.downloadDir, filename);
          fs.writeFileSync(filePath, buffer);

          return { response, filePath, fileSize: buffer.length };
        } else {
          const text = await response.text();
          console.log(`❌ Download failed: ${text}`);
          return { response, error: text };
        }
      }

      // Handle regular JSON/text responses
      const buffer = await response.buffer();
      const text = buffer.toString('latin1'); // Use latin1 to preserve binary data
      let data;

      // Check if this looks like binary data that should have been saved as a file
      if (
        text.startsWith('PK') || // ZIP file magic number
        text.includes('\x00') || // Contains null bytes (likely binary)
        (text.length > 1000 &&
          !text.substring(0, 1000).match(/^[\x20-\x7E\s]*$/))
      ) {
        // Non-printable chars
        // Save the file anyway
        const filename = `download-${Date.now()}.zip`;
        const filePath = path.join(this.downloadDir, filename);
        fs.writeFileSync(filePath, buffer);
        return { response, filePath, fileSize: buffer.length };
      }

      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      // Show response preview
      if (typeof data === 'object' && data !== null) {
        if (Array.isArray(data)) {
          console.log(`📄 Array with ${data.length} items`);
          if (data.length > 0) {
            console.log(
              `   First item: ${JSON.stringify(data[0]).substring(0, 100)}...`,
            );
          }
        } else {
          const keys = Object.keys(data);
          console.log(
            `📄 Object with keys: ${keys.slice(0, 5).join(', ')}${
              keys.length > 5 ? '...' : ''
            }`,
          );
        }
      } else {
        console.log(
          `📄 ${String(data).substring(0, 200)}${
            String(data).length > 200 ? '...' : ''
          }`,
        );
      }

      return { response, data };
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      return { error };
    }
  }

  async get(urlPath) {
    return this.request('GET', urlPath);
  }

  async post(urlPath, body, options = {}) {
    return this.request('POST', urlPath, body, options);
  }

  async put(urlPath, body) {
    return this.request('PUT', urlPath, body);
  }

  async delete(urlPath) {
    return this.request('DELETE', urlPath);
  }
}

// Command line usage
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
📋 Usage: node test-endpoints.js <method> <path> [username] [password]

Examples:
  node test-endpoints.js GET /api/catalog/datasets
  node test-endpoints.js GET /api/data/query username password
  node test-endpoints.js POST /api/user/signin '{"username":"test@example.com","password":"testPassword123"}'

Common endpoints to test:
  GET  /api/catalog/datasets                    - List all datasets
  GET  /api/catalog/cruises                     - List cruises  
  GET  /api/catalog/variables                   - List variables
  GET  /api/user/profile                        - User profile (requires auth)
  POST /api/user/signin                         - Login
  GET  /api/news                                - News items
    `);
    process.exit(1);
  }

  const [method, urlPath, username, password] = args;
  const tester = new EndpointTester();

  // Login if credentials provided
  if (username && password) {
    const loginSuccess = await tester.login(username, password);
    if (!loginSuccess) {
      console.log('⚠️  Login failed, continuing without authentication...');
    }
  }

  // Handle POST body from command line
  let body = null;
  if (method.toLowerCase() === 'post' && args[2] && args[2].startsWith('{')) {
    try {
      body = JSON.parse(args[2]);
    } catch (e) {
      console.log('❌ Invalid JSON body');
      process.exit(1);
    }
  }

  await tester.request(method.toUpperCase(), urlPath, body);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = EndpointTester;
