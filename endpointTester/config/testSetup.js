// Test setup for endpoint testing
// Load environment variables
require('dotenv').config();

// Set test-specific environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || '0'; // Minimal logging during tests

// Global test timeout (can be overridden per test)
jest.setTimeout(10000);

// Suppress console warnings during testing unless verbose mode
if (!process.env.VERBOSE) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    // Only show warnings that might be test-relevant
    const message = args[0];
    if (typeof message === 'string' && (
      message.includes('deprecated') ||
      message.includes('warning') ||
      message.includes('error')
    )) {
      originalWarn(...args);
    }
  };
}

// Global cleanup after each test
afterEach(() => {
  // Clear any test data that might have been created
  // This will be implemented by individual test classes
});

// Global setup before all tests
beforeAll(() => {
  // Validate required environment variables
  const requiredEnvVars = [
    'DB_HOST_RAINIER',
    'DB_USER',
    'API_BASE_URL'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('Some endpoint tests may fail due to missing configuration.');
  }
});