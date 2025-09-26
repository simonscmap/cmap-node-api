/**
 * TestRunner - Core test execution engine with fluent API
 * Provides a chainable interface for building and executing endpoint tests
 */

const axios = require('axios');
const AuthProvider = require('./AuthProvider');
const ResponseValidator = require('./ResponseValidator');
const ErrorFormatter = require('./ErrorFormatter');

class TestRunner {
  constructor(baseUrl = process.env.API_BASE_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.config = {
      method: 'GET',
      endpoint: '',
      headers: { 'Content-Type': 'application/json' },
      queryParams: {},
      body: null,
      auth: null,
      authStrategy: null,
      expectedStatus: 200,
      expectedStructure: null,
      expectedHeaders: {},
      timeout: 10000,
      validateResponse: true
    };

    this.authProvider = new AuthProvider();
    this.responseValidator = new ResponseValidator();
    this.errorFormatter = new ErrorFormatter();
  }

  /**
   * HTTP Method builders
   */
  get(endpoint) {
    this.config.method = 'GET';
    this.config.endpoint = endpoint;
    return this;
  }

  post(endpoint) {
    this.config.method = 'POST';
    this.config.endpoint = endpoint;
    return this;
  }

  put(endpoint) {
    this.config.method = 'PUT';
    this.config.endpoint = endpoint;
    return this;
  }

  delete(endpoint) {
    this.config.method = 'DELETE';
    this.config.endpoint = endpoint;
    return this;
  }

  /**
   * Request configuration builders
   */
  withAuth(strategy = null) {
    this.config.authStrategy = strategy;
    return this;
  }

  withQuery(params) {
    this.config.queryParams = { ...this.config.queryParams, ...params };
    return this;
  }

  withHeaders(headers) {
    this.config.headers = { ...this.config.headers, ...headers };
    return this;
  }

  withBody(body) {
    this.config.body = body;
    return this;
  }

  withTimeout(ms) {
    this.config.timeout = ms;
    return this;
  }

  /**
   * Response expectation builders
   */
  expectStatus(code) {
    this.config.expectedStatus = code;
    return this;
  }

  expectBodyStructure(fields) {
    this.config.expectedStructure = fields;
    return this;
  }

  expectHeader(key, value) {
    this.config.expectedHeaders[key] = value;
    return this;
  }

  skipValidation() {
    this.config.validateResponse = false;
    return this;
  }

  /**
   * Build the full URL with query parameters
   */
  buildUrl() {
    const url = new URL(this.config.endpoint, this.baseUrl);

    // Add query parameters
    Object.keys(this.config.queryParams).forEach(key => {
      url.searchParams.append(key, this.config.queryParams[key]);
    });

    return url.toString();
  }

  /**
   * Build axios request configuration
   */
  async buildRequestConfig() {
    const url = this.buildUrl();

    // Apply authentication
    let headers = { ...this.config.headers };
    try {
      headers = await this.authProvider.applyAuth(
        this.config.endpoint,
        this.config.method,
        headers,
        this.config.authStrategy
      );
    } catch (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    const requestConfig = {
      method: this.config.method.toLowerCase(),
      url: url,
      headers: headers,
      timeout: this.config.timeout
    };

    // Add body for POST/PUT requests
    if (this.config.body && ['POST', 'PUT'].includes(this.config.method)) {
      requestConfig.data = this.config.body;
    }

    // Handle response type for potential file downloads
    if (this.config.expectedHeaders && this.config.expectedHeaders['Content-Type']) {
      const contentType = this.config.expectedHeaders['Content-Type'];
      if (contentType.includes('zip') || contentType.includes('octet-stream')) {
        requestConfig.responseType = 'stream';
      }
    }

    return requestConfig;
  }

  /**
   * Determine if we should retry with different authentication
   */
  shouldRetryForAuth(error, retryCount) {
    // Only retry once
    if (retryCount > 0) {
      return false;
    }

    // Check if it's a 401 Unauthorized error
    if (error.response && error.response.status === 401) {
      return true;
    }

    // Check for authentication-related error messages
    const errorMessage = error.message || '';
    const authErrorPatterns = [
      'jwt must be provided',
      'Authentication failed',
      'guest authentication strategy',
      'token required'
    ];

    return authErrorPatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Execute the test and return detailed results
   */
  async run(retryCount = 0) {
    const startTime = Date.now();

    try {
      // Build request configuration
      const requestConfig = await this.buildRequestConfig();

      // Execute the request
      const response = await axios(requestConfig);
      const executionTime = Date.now() - startTime;

      // Build result object
      const result = {
        status: 'PASS',
        executionTime: executionTime,
        request: {
          method: requestConfig.method.toUpperCase(),
          url: requestConfig.url,
          headers: requestConfig.headers,
          body: requestConfig.data || null
        },
        response: {
          status: response.status,
          headers: response.headers,
          body: response.data,
          size: response.headers['content-length'] || 'unknown'
        },
        validationResults: [],
        errors: []
      };

      // Skip validation if requested
      if (!this.config.validateResponse) {
        return result;
      }

      // Validate response
      try {
        const validationResults = await this.responseValidator.validate({
          status: response.status,
          headers: response.headers,
          body: response.data
        }, {
          expectedStatus: this.config.expectedStatus,
          expectedStructure: this.config.expectedStructure,
          expectedHeaders: this.config.expectedHeaders
        });

        result.validationResults = validationResults;

        // Check if any validations failed
        const failures = validationResults.filter(v => !v.passed);
        if (failures.length > 0) {
          result.status = 'FAIL';
          result.errors = failures.map(f => f.message);
        }

      } catch (validationError) {
        result.status = 'ERROR';
        result.errors = [`Validation error: ${validationError.message}`];
      }

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Check if this is an authentication error that we can retry
      if (this.shouldRetryForAuth(error, retryCount)) {
        console.log(`🔄 Authentication failed, trying alternative authentication...`);
        try {
          // Try to use no authentication as fallback for optional auth endpoints
          this.config.authStrategy = 'none';
          return await this.run(retryCount + 1);
        } catch (retryError) {
          // If retry also fails, continue with original error handling
        }
      }

      // Handle axios errors with response
      if (error.response) {
        const result = {
          status: 'FAIL',
          executionTime: executionTime,
          request: {
            method: this.config.method,
            url: this.buildUrl(),
            headers: this.config.headers,
            body: this.config.body
          },
          response: {
            status: error.response.status,
            headers: error.response.headers,
            body: error.response.data
          },
          validationResults: [],
          errors: [this.errorFormatter.formatHttpError(error)]
        };

        // Still validate if we got a response but it was an error status
        if (this.config.validateResponse && error.response.status === this.config.expectedStatus) {
          try {
            const validationResults = await this.responseValidator.validate({
              status: error.response.status,
              headers: error.response.headers,
              body: error.response.data
            }, {
              expectedStatus: this.config.expectedStatus,
              expectedStructure: this.config.expectedStructure,
              expectedHeaders: this.config.expectedHeaders
            });

            result.validationResults = validationResults;

            // If validations pass and status matches expected, this might be a successful test
            const failures = validationResults.filter(v => !v.passed);
            if (failures.length === 0) {
              result.status = 'PASS';
              result.errors = [];
            }
          } catch (validationError) {
            result.errors.push(`Validation error: ${validationError.message}`);
          }
        }

        return result;
      }

      // Handle network errors, timeouts, etc.
      return {
        status: 'ERROR',
        executionTime: executionTime,
        request: {
          method: this.config.method,
          url: this.buildUrl(),
          headers: this.config.headers,
          body: this.config.body
        },
        response: null,
        validationResults: [],
        errors: [this.errorFormatter.formatNetworkError(error)]
      };
    }
  }

  /**
   * Static factory methods for convenience
   */
  static get(endpoint) {
    return new TestRunner().get(endpoint);
  }

  static post(endpoint) {
    return new TestRunner().post(endpoint);
  }

  static put(endpoint) {
    return new TestRunner().put(endpoint);
  }

  static delete(endpoint) {
    return new TestRunner().delete(endpoint);
  }

  /**
   * Create a new TestRunner instance with custom base URL
   */
  static create(baseUrl) {
    return new TestRunner(baseUrl);
  }

  /**
   * Run a quick test with minimal configuration
   */
  static async quickTest(endpoint, method = 'GET', expectedStatus = 200) {
    const runner = new TestRunner();
    return runner[method.toLowerCase()](endpoint)
      .expectStatus(expectedStatus)
      .run();
  }

  /**
   * Get current configuration for debugging
   */
  getConfig() {
    return { ...this.config };
  }
}

module.exports = TestRunner;