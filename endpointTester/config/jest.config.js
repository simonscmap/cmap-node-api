module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Root directory for tests and modules
  rootDir: '../../',

  // Test file patterns
  testMatch: [
    '<rootDir>/endpointTester/tests/**/*.test.js'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/' // Ignore existing AVA tests
  ],

  // Coverage settings (disabled for endpoint testing)
  collectCoverage: false,

  // Timeout settings (10 seconds default as per requirements)
  testTimeout: 10000,

  // Setup files
  setupFilesAfterEnv: [],

  // Module paths
  modulePaths: [
    '<rootDir>/endpointTester'
  ],

  // Environment variables
  setupFiles: ['<rootDir>/endpointTester/config/testSetup.js'],

  // Verbose output for debugging
  verbose: true,

  // Disable cache for endpoint testing to ensure fresh runs
  cache: false,

  // Error handling
  errorOnDeprecated: false,

  // Node 12 compatibility settings
  transform: {},
  transformIgnorePatterns: [
    '/node_modules/'
  ]
};