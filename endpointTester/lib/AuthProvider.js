/**
 * AuthProvider - Authentication strategy detection and application
 * Automatically detects and applies the appropriate authentication for endpoints
 */

const { endpoints, helpers, AUTH } = require('../config/endpoints');
const path = require('path');
require('dotenv').config();

class AuthProvider {
  constructor() {
    this.authCache = new Map();
    this.credentials = this.loadCredentials();
  }

  /**
   * Load authentication credentials from environment and config
   */
  loadCredentials() {
    return {
      apiKey: process.env.TEST_API_KEY || process.env.API_KEY || 'test-api-key-12345',
      jwtToken: process.env.TEST_JWT_TOKEN || process.env.JWT_TOKEN || null,
      guestToken: process.env.TEST_GUEST_TOKEN || process.env.GUEST_TOKEN || null,
      username: process.env.TEST_USERNAME || process.env.USERNAME || 'test@example.com',
      password: process.env.TEST_PASSWORD || process.env.PASSWORD || 'testpassword'
    };
  }

  /**
   * Auto-detect authentication strategy for an endpoint
   */
  detectAuthStrategy(endpoint, method = 'GET') {
    const cacheKey = `${method}:${endpoint}`;

    // Check cache first
    if (this.authCache.has(cacheKey)) {
      return this.authCache.get(cacheKey);
    }

    // Find endpoint configuration
    const endpointConfig = helpers.findEndpoint(endpoint, method);

    let strategy = AUTH.NONE;

    if (endpointConfig && endpointConfig.auth) {
      strategy = endpointConfig.auth;
    } else {
      // Fallback: analyze endpoint path patterns
      strategy = this.analyzeEndpointPath(endpoint);
    }

    // Cache the result
    this.authCache.set(cacheKey, strategy);
    return strategy;
  }

  /**
   * Analyze endpoint path to guess authentication requirements
   * Fallback method when endpoint is not in configuration
   */
  analyzeEndpointPath(endpoint) {
    const path = endpoint.toLowerCase();

    // Public endpoints (usually no auth required)
    if (path.includes('/collections') ||
        path.includes('/catalog') ||
        path.includes('/bulk-download-row-counts') ||
        path.includes('/bulk-download-init')) {
      return AUTH.NONE;
    }

    // User-specific endpoints (usually require JWT)
    if (path.includes('/user/') ||
        path.includes('/profile') ||
        path.includes('/cart') ||
        path.includes('/generateapikey') ||
        path.includes('/retrieveapikeys')) {
      return AUTH.JWT;
    }

    // Data submission endpoints (usually require strong auth)
    if (path.includes('/datasubmission') ||
        path.includes('/upload')) {
      return AUTH.MULTIPLE;
    }

    // Bulk download (usually flexible auth)
    if (path.includes('/bulk-download')) {
      return AUTH.MULTIPLE;
    }

    // Login/signup endpoints (use local auth)
    if (path.includes('/signin') || path.includes('/login')) {
      return AUTH.LOCAL;
    }

    if (path.includes('/signup') || path.includes('/register')) {
      return AUTH.NONE;
    }

    // Default to no auth for unknown endpoints (safer for testing)
    return AUTH.NONE;
  }

  /**
   * Apply authentication to headers based on strategy
   */
  async applyAuth(endpoint, method = 'GET', headers = {}, forceStrategy = null) {
    const strategy = forceStrategy || this.detectAuthStrategy(endpoint, method);

    // Clone headers to avoid mutation
    let authHeaders = { ...headers };

    switch (strategy) {
      case AUTH.NONE:
        // No authentication needed
        break;

      case AUTH.JWT:
        authHeaders = this.applyJwtAuth(authHeaders);
        break;

      case AUTH.API_KEY:
        authHeaders = this.applyApiKeyAuth(authHeaders);
        break;

      case AUTH.LOCAL:
        // Local auth doesn't modify headers - credentials go in body
        break;

      case AUTH.GUEST:
        authHeaders = this.applyGuestAuth(authHeaders);
        break;

      case AUTH.MULTIPLE:
        authHeaders = this.applyMultipleAuth(authHeaders);
        break;

      case AUTH.REQUIRED:
        // Try the most common auth method
        authHeaders = this.applyPreferredAuth(authHeaders);
        break;

      case 'browserOnly':
        // Skip browser-only endpoints in CLI testing
        throw new Error('Endpoint requires browser-only authentication (cookies/sessions)');

      default:
        console.warn(`Unknown auth strategy: ${strategy}, proceeding without auth`);
        break;
    }

    return authHeaders;
  }

  /**
   * Apply JWT authentication
   */
  applyJwtAuth(headers) {
    if (!this.credentials.jwtToken) {
      throw new Error('JWT token required but not available. Set TEST_JWT_TOKEN environment variable.');
    }

    return {
      ...headers,
      'Authorization': `Bearer ${this.credentials.jwtToken}`
    };
  }

  /**
   * Apply API key authentication
   */
  applyApiKeyAuth(headers) {
    if (!this.credentials.apiKey) {
      throw new Error('API key required but not available. Set TEST_API_KEY environment variable.');
    }

    return {
      ...headers,
      'x-api-key': this.credentials.apiKey
    };
  }

  /**
   * Apply guest token authentication
   */
  applyGuestAuth(headers) {
    if (!this.credentials.guestToken) {
      throw new Error('Guest token required but not available. Set TEST_GUEST_TOKEN environment variable.');
    }

    return {
      ...headers,
      'Authorization': `Bearer ${this.credentials.guestToken}`
    };
  }

  /**
   * Apply multiple authentication strategies (try API key first, then JWT)
   */
  applyMultipleAuth(headers) {
    // Prefer API key if available
    if (this.credentials.apiKey) {
      return this.applyApiKeyAuth(headers);
    }

    // Fall back to JWT
    if (this.credentials.jwtToken) {
      return this.applyJwtAuth(headers);
    }

    // Fall back to guest token
    if (this.credentials.guestToken) {
      return this.applyGuestAuth(headers);
    }

    throw new Error('Multiple auth strategies supported but no valid credentials available. Set TEST_API_KEY, TEST_JWT_TOKEN, or TEST_GUEST_TOKEN.');
  }

  /**
   * Apply preferred authentication (default fallback)
   */
  applyPreferredAuth(headers) {
    // Try in order of preference: API Key > JWT > Guest
    if (this.credentials.apiKey) {
      return this.applyApiKeyAuth(headers);
    }

    if (this.credentials.jwtToken) {
      return this.applyJwtAuth(headers);
    }

    if (this.credentials.guestToken) {
      return this.applyGuestAuth(headers);
    }

    throw new Error('Authentication required but no valid credentials available. Set TEST_API_KEY, TEST_JWT_TOKEN, or TEST_GUEST_TOKEN.');
  }

  /**
   * Validate that required credentials are available
   */
  validateCredentials() {
    const issues = [];

    if (!this.credentials.apiKey || this.credentials.apiKey === 'test-api-key-12345') {
      issues.push('API key not configured or using default test value. Set TEST_API_KEY environment variable.');
    }

    if (!this.credentials.jwtToken) {
      issues.push('JWT token not configured. Set TEST_JWT_TOKEN environment variable if testing authenticated endpoints.');
    }

    if (!this.credentials.guestToken) {
      issues.push('Guest token not configured. Set TEST_GUEST_TOKEN environment variable if testing guest access.');
    }

    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }

  /**
   * Get authentication info for an endpoint
   */
  getAuthInfo(endpoint, method = 'GET') {
    const strategy = this.detectAuthStrategy(endpoint, method);
    const endpointConfig = helpers.findEndpoint(endpoint, method);

    return {
      strategy: strategy,
      description: this.getStrategyDescription(strategy),
      required: strategy !== AUTH.NONE,
      configuredEndpoint: !!endpointConfig,
      availableCredentials: {
        apiKey: !!this.credentials.apiKey && this.credentials.apiKey !== 'test-api-key-12345',
        jwtToken: !!this.credentials.jwtToken,
        guestToken: !!this.credentials.guestToken
      }
    };
  }

  /**
   * Get human-readable description of auth strategy
   */
  getStrategyDescription(strategy) {
    const descriptions = {
      [AUTH.NONE]: 'No authentication required',
      [AUTH.JWT]: 'JWT token authentication',
      [AUTH.API_KEY]: 'API key authentication',
      [AUTH.LOCAL]: 'Username/password authentication',
      [AUTH.GUEST]: 'Guest token authentication',
      [AUTH.MULTIPLE]: 'Multiple authentication methods accepted',
      [AUTH.REQUIRED]: 'Some form of authentication required',
      'browserOnly': 'Browser-only authentication (cookies/sessions)'
    };

    return descriptions[strategy] || `Unknown strategy: ${strategy}`;
  }

  /**
   * Update credentials at runtime
   */
  updateCredentials(newCredentials) {
    this.credentials = { ...this.credentials, ...newCredentials };
    // Clear cache since auth might change
    this.authCache.clear();
  }

  /**
   * Clear authentication cache
   */
  clearCache() {
    this.authCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.authCache.size,
      keys: Array.from(this.authCache.keys())
    };
  }
}

module.exports = AuthProvider;