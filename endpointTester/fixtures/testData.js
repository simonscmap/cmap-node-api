/**
 * Shared test data fixtures for endpoint testing
 * Contains reusable test data for various endpoint scenarios
 */

// User-related test data
const users = {
  valid: {
    email: 'test.user@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    organization: 'Test Organization'
  },

  // Invalid data for negative testing
  invalid: {
    missingEmail: {
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    },
    invalidEmail: {
      email: 'invalid-email',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    },
    weakPassword: {
      email: 'test.user@example.com',
      password: '123',
      firstName: 'Test',
      lastName: 'User'
    }
  },

  // For signin testing
  signin: {
    email: 'test.user@example.com',
    password: 'TestPassword123!'
  }
};

// Dataset-related test data
const datasets = {
  // Example dataset short names for bulk download testing
  valid: {
    shortNames: [
      'example_dataset_1',
      'example_dataset_2'
    ],
    singleDataset: ['example_dataset_1']
  },

  // Invalid dataset names for negative testing
  invalid: {
    nonExistent: ['non_existent_dataset'],
    empty: [],
    invalidFormat: ['invalid dataset name!@#']
  },

  // Bulk download parameters
  bulkDownload: {
    basic: {
      shortNames: ['example_dataset_1']
    },
    withFilters: {
      shortNames: ['example_dataset_1', 'example_dataset_2'],
      filters: {
        temporal: {
          startDate: '2020-01-01',
          endDate: '2020-12-31'
        },
        spatial: {
          latMin: 10,
          latMax: 50,
          lonMin: -120,
          lonMax: -80,
          depthMin: 0,
          depthMax: 100
        }
      }
    },
    withTemporalFilter: {
      shortNames: ['example_dataset_1'],
      filters: {
        temporal: {
          startDate: '2021-01-01',
          endDate: '2021-12-31'
        }
      }
    },
    withSpatialFilter: {
      shortNames: ['example_dataset_1'],
      filters: {
        spatial: {
          latMin: -10,
          latMax: 10,
          lonMin: -10,
          lonMax: 10
        }
      }
    }
  }
};

// Collection-related test data
const collections = {
  validIds: [1, 2, 3],
  invalidIds: [-1, 999999, 'invalid'],

  // Sample collection structure for validation
  sampleCollection: {
    id: 1,
    name: 'Sample Collection',
    description: 'A sample collection for testing',
    datasets: [
      {
        id: 1,
        shortName: 'example_dataset_1',
        longName: 'Example Dataset 1'
      }
    ]
  }
};

// API authentication test data
const auth = {
  // Mock API key for testing (should be replaced with real test key)
  apiKey: 'test-api-key-12345',

  // Mock JWT token structure (should be replaced with real test token)
  jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',

  // Guest token structure
  guestToken: 'guest-token-12345',

  // Headers for different auth methods
  headers: {
    apiKey: {
      'x-api-key': 'test-api-key-12345',
      'Content-Type': 'application/json'
    },
    jwt: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
      'Content-Type': 'application/json'
    },
    guest: {
      'Authorization': 'Bearer guest-token-12345',
      'Content-Type': 'application/json'
    },
    none: {
      'Content-Type': 'application/json'
    }
  }
};

// Common query parameters for testing
const queryParams = {
  pagination: {
    limit: 10,
    offset: 0
  },

  largePagination: {
    limit: 100,
    offset: 50
  },

  // Invalid pagination for negative testing
  invalidPagination: {
    limit: -1,
    offset: -5
  }
};

// Expected response structures for validation
const responseStructures = {
  collections: {
    list: ['id', 'name', 'description'],
    detail: ['id', 'name', 'description', 'datasets']
  },

  datasets: {
    metadata: ['id', 'shortName', 'longName', 'description'],
    bulkDownloadInit: ['datasetsMetadata'],
    bulkDownloadRowCounts: {} // Dynamic keys based on dataset shortNames
  },

  user: {
    signin: ['token', 'user'],
    profile: ['id', 'email', 'firstName', 'lastName'],
    apiKeys: ['apiKeys'],
    cart: ['cartItems']
  },

  error: {
    standard: ['error', 'message'],
    validation: ['error', 'message', 'details']
  }
};

// Environment-specific configuration
const environment = {
  // Base URLs for different environments
  baseUrls: {
    development: 'http://localhost:3000',
    staging: 'https://staging-api.example.com',
    production: 'https://api.example.com'
  },

  // Default timeout values
  timeouts: {
    fast: 2000,      // For simple GET requests
    normal: 5000,    // For standard API calls
    slow: 10000,     // For complex queries
    bulk: 30000      // For bulk operations and file downloads
  },

  // Retry configuration
  retry: {
    attempts: 3,
    delay: 1000
  }
};

// Test cleanup data - IDs and references that should be cleaned up after tests
const cleanup = {
  // These will be populated during test runs and cleaned up after
  createdUserIds: [],
  createdApiKeys: [],
  uploadedFiles: [],
  testSubmissions: [],

  // Cleanup functions (to be implemented by test framework)
  cleanupFunctions: {
    users: async (userIds) => {
      // Implementation will be added by individual test suites
      console.log('Cleaning up test users:', userIds);
    },

    files: async (fileIds) => {
      // Implementation will be added by individual test suites
      console.log('Cleaning up test files:', fileIds);
    },

    submissions: async (submissionIds) => {
      // Implementation will be added by individual test suites
      console.log('Cleaning up test submissions:', submissionIds);
    }
  }
};

// Utility functions for test data manipulation
const utils = {
  /**
   * Get a random dataset from the valid list
   */
  getRandomDataset: () => {
    const shortNames = datasets.valid.shortNames;
    return shortNames[Math.floor(Math.random() * shortNames.length)];
  },

  /**
   * Generate a unique test email address
   */
  generateTestEmail: (prefix = 'test') => {
    const timestamp = Date.now();
    return `${prefix}.${timestamp}@endpoint-test.local`;
  },

  /**
   * Generate test user data with unique email
   */
  generateTestUser: (overrides = {}) => {
    return {
      ...users.valid,
      email: utils.generateTestEmail(),
      ...overrides
    };
  },

  /**
   * Add cleanup item
   */
  addCleanupItem: (type, id) => {
    if (cleanup[`created${type}`]) {
      cleanup[`created${type}`].push(id);
    }
  },

  /**
   * Execute cleanup for specific type
   */
  executeCleanup: async (type) => {
    const items = cleanup[`created${type}`];
    const cleanupFn = cleanup.cleanupFunctions[type.toLowerCase()];

    if (items && items.length > 0 && cleanupFn) {
      await cleanupFn(items);
      cleanup[`created${type}`] = [];
    }
  },

  /**
   * Execute all cleanup
   */
  executeAllCleanup: async () => {
    await Promise.all([
      utils.executeCleanup('UserIds'),
      utils.executeCleanup('files'),
      utils.executeCleanup('submissions')
    ]);
  },

  /**
   * Deep clone test data to avoid mutations
   */
  clone: (obj) => {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Merge test data with overrides
   */
  merge: (baseData, overrides = {}) => {
    return { ...utils.clone(baseData), ...overrides };
  }
};

module.exports = {
  users,
  datasets,
  collections,
  auth,
  queryParams,
  responseStructures,
  environment,
  cleanup,
  utils
};