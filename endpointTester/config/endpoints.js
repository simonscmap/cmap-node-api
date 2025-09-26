/**
 * Endpoint definitions and authentication mappings for API testing
 * Based on routes analysis from api.js and individual route files
 */

// Authentication strategy constants
const AUTH = {
  NONE: 'none',
  JWT: 'jwt',
  API_KEY: 'headerapikey',
  LOCAL: 'local',
  GUEST: 'guest',
  MULTIPLE: 'multiple', // Multiple auth strategies accepted
  REQUIRED: 'required' // Some form of auth required but flexible
};

// Authentication strategy mappings
const authStrategies = {
  [AUTH.NONE]: {
    name: 'None',
    description: 'No authentication required',
    apply: (headers) => headers
  },

  [AUTH.JWT]: {
    name: 'JWT Token',
    description: 'JSON Web Token authentication via cookie or Authorization header',
    apply: (headers, token) => {
      if (token) {
        return { ...headers, 'Authorization': `Bearer ${token}` };
      }
      // JWT can also come from cookies - handled by passport middleware
      return headers;
    }
  },

  [AUTH.API_KEY]: {
    name: 'API Key',
    description: 'API key authentication via x-api-key header',
    apply: (headers, apiKey) => {
      if (apiKey) {
        return { ...headers, 'x-api-key': apiKey };
      }
      return headers;
    }
  },

  [AUTH.LOCAL]: {
    name: 'Local Auth',
    description: 'Username/password authentication for login',
    apply: (headers, credentials) => {
      // Local auth sends credentials in request body, not headers
      return headers;
    }
  },

  [AUTH.GUEST]: {
    name: 'Guest Token',
    description: 'Guest access token for limited functionality',
    apply: (headers, guestToken) => {
      if (guestToken) {
        return { ...headers, 'Authorization': `Bearer ${guestToken}` };
      }
      return headers;
    }
  },

  [AUTH.MULTIPLE]: {
    name: 'Multiple Auth',
    description: 'Accepts multiple authentication strategies',
    apply: (headers, credentials) => {
      // Try API key first, then JWT
      if (credentials.apiKey) {
        return { ...headers, 'x-api-key': credentials.apiKey };
      }
      if (credentials.token) {
        return { ...headers, 'Authorization': `Bearer ${credentials.token}` };
      }
      return headers;
    }
  }
};

// Endpoint definitions organized by route groups
const endpoints = {
  // Collections endpoints (optional authentication)
  collections: {
    baseUrl: '/api/collections',
    endpoints: [
      {
        method: 'GET',
        path: '/',
        name: 'List Collections',
        auth: AUTH.MULTIPLE, // Uses passport.authenticate(['headerapikey', 'jwt', 'guest'])
        expectedStatus: 200,
        expectedStructure: ['id', 'name', 'description'],
        timeout: 5000
      },
      {
        method: 'GET',
        path: '/:id',
        name: 'Collection Detail',
        auth: AUTH.MULTIPLE, // Uses passport.authenticate(['headerapikey', 'jwt', 'guest'])
        expectedStatus: 200,
        expectedStructure: ['id', 'name', 'description', 'datasets'],
        timeout: 5000,
        pathParams: { id: 1 } // Default test ID
      }
    ]
  },

  // User endpoints (various auth requirements)
  user: {
    baseUrl: '/api/user',
    endpoints: [
      {
        method: 'POST',
        path: '/signup',
        name: 'User Signup',
        auth: AUTH.NONE,
        expectedStatus: 201,
        expectedStructure: ['message'],
        timeout: 5000
      },
      {
        method: 'POST',
        path: '/signin',
        name: 'User Signin',
        auth: AUTH.LOCAL,
        expectedStatus: 200,
        expectedStructure: ['token', 'user'],
        timeout: 5000,
        bodyParams: {
          email: 'test@example.com',
          password: 'testpassword'
        }
      },
      {
        method: 'GET',
        path: '/generateapikey',
        name: 'Generate API Key',
        auth: AUTH.JWT,
        expectedStatus: 200,
        expectedStructure: ['apiKey'],
        timeout: 5000
      },
      {
        method: 'GET',
        path: '/retrieveapikeys',
        name: 'Retrieve API Keys',
        auth: AUTH.JWT,
        expectedStatus: 200,
        expectedStructure: ['apiKeys'],
        timeout: 5000
      },
      {
        method: 'GET',
        path: '/getcart',
        name: 'Get User Cart',
        auth: AUTH.JWT,
        expectedStatus: 200,
        expectedStructure: ['cartItems'],
        timeout: 5000
      },
      {
        method: 'GET',
        path: '/getguesttoken',
        name: 'Get Guest Token',
        auth: 'browserOnly', // Special browser-only auth strategy
        expectedStatus: 200,
        expectedStructure: ['token'],
        timeout: 5000
      }
    ]
  },

  // Data endpoints (bulk download with flexible auth)
  data: {
    baseUrl: '/api/data',
    endpoints: [
      {
        method: 'POST',
        path: '/bulk-download',
        name: 'Bulk Download',
        auth: AUTH.MULTIPLE, // Accepts 'headerapikey', 'jwt', 'guest'
        expectedStatus: 200,
        expectedHeaders: { 'Content-Type': 'application/zip' },
        timeout: 30000, // Longer timeout for file downloads
        bodyParams: {
          shortNames: ['example_dataset']
        }
      },
      {
        method: 'POST',
        path: '/bulk-download-row-counts',
        name: 'Bulk Download Row Counts',
        auth: AUTH.NONE,
        expectedStatus: 200,
        expectedStructure: ['example_dataset'],
        timeout: 10000,
        bodyParams: {
          shortNames: ['example_dataset']
        }
      },
      {
        method: 'POST',
        path: '/bulk-download-init',
        name: 'Bulk Download Init',
        auth: AUTH.NONE,
        expectedStatus: 200,
        expectedStructure: ['datasetsMetadata'],
        timeout: 10000,
        bodyParams: {
          shortNames: ['example_dataset']
        }
      }
    ]
  },

  // Catalog endpoints (public access)
  catalog: {
    baseUrl: '/api/catalog',
    endpoints: [
      {
        method: 'GET',
        path: '/',
        name: 'List Catalog',
        auth: AUTH.NONE,
        expectedStatus: 200,
        expectedStructure: ['datasets'],
        timeout: 5000
      }
    ]
  },

  // Data submission endpoints (authenticated only)
  datasubmission: {
    baseUrl: '/api/datasubmission',
    endpoints: [
      {
        method: 'POST',
        path: '/',
        name: 'Submit Data',
        auth: AUTH.MULTIPLE, // Uses passport authentication with headerapikey and jwt
        expectedStatus: 201,
        expectedStructure: ['submissionId'],
        timeout: 30000,
        requiresMultipart: true
      }
    ]
  }
};

// Helper functions for endpoint testing
const helpers = {
  /**
   * Get full URL for an endpoint
   */
  getFullUrl: (baseUrl, endpoint, pathParams = {}) => {
    let path = endpoint.path;

    // Replace path parameters
    Object.keys(pathParams).forEach(param => {
      path = path.replace(`:${param}`, pathParams[param]);
    });

    return baseUrl + path;
  },

  /**
   * Get authentication strategy for endpoint
   */
  getAuthStrategy: (authType) => {
    return authStrategies[authType] || authStrategies[AUTH.NONE];
  },

  /**
   * Apply authentication to headers
   */
  applyAuth: (endpoint, headers = {}, credentials = {}) => {
    const strategy = helpers.getAuthStrategy(endpoint.auth);
    return strategy.apply(headers, credentials);
  },

  /**
   * Get all endpoints as flat array
   */
  getAllEndpoints: () => {
    const allEndpoints = [];

    Object.keys(endpoints).forEach(groupKey => {
      const group = endpoints[groupKey];
      group.endpoints.forEach(endpoint => {
        allEndpoints.push({
          ...endpoint,
          group: groupKey,
          baseUrl: group.baseUrl,
          fullPath: helpers.getFullUrl(group.baseUrl, endpoint, endpoint.pathParams)
        });
      });
    });

    return allEndpoints;
  },

  /**
   * Find endpoints by group
   */
  getEndpointsByGroup: (groupName) => {
    const group = endpoints[groupName];
    if (!group) return [];

    return group.endpoints.map(endpoint => ({
      ...endpoint,
      group: groupName,
      baseUrl: group.baseUrl,
      fullPath: helpers.getFullUrl(group.baseUrl, endpoint, endpoint.pathParams)
    }));
  },

  /**
   * Find specific endpoint
   */
  findEndpoint: (path, method = 'GET') => {
    const allEndpoints = helpers.getAllEndpoints();
    return allEndpoints.find(endpoint =>
      endpoint.fullPath === path && endpoint.method.toLowerCase() === method.toLowerCase()
    );
  }
};

module.exports = {
  AUTH,
  authStrategies,
  endpoints,
  helpers
};