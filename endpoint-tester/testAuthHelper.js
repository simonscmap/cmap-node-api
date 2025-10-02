const jwt = require('jsonwebtoken');
const { getTestUserCredentials, getBulkDownloadCredentials, getJwtSecret } = require('./environmentAuth');
const { AUTH_METHODS } = require('./authMethods');

class TestAuthHelper {
  constructor() {
    this.testUser = null;
    this.bulkUser = null;
  }

  getBasicAuth() {
    if (!this.testUser) {
      this.testUser = getTestUserCredentials();
    }
    return {
      username: this.testUser.email,
      password: this.testUser.password
    };
  }

  getBulkDownloadAuth() {
    if (!this.bulkUser) {
      this.bulkUser = getBulkDownloadCredentials();
    }
    return {
      username: this.bulkUser.email,
      password: this.bulkUser.password
    };
  }

  getApiKeyAuth() {
    if (!this.testUser) {
      this.testUser = getTestUserCredentials();
    }
    return {
      apiKey: this.testUser.apiKey,
      headers: this.testUser.apiKey ? {
        'Authorization': `Api-Key ${this.testUser.apiKey}`
      } : {}
    };
  }

  generateJwtToken(userPayload = {}) {
    const defaultPayload = {
      id: 1,
      email: this.getBasicAuth().username,
      ...userPayload
    };

    const secret = getJwtSecret();
    return jwt.sign(defaultPayload, secret, { expiresIn: '24h' });
  }

  getJwtAuth(userPayload = {}) {
    const token = this.generateJwtToken(userPayload);
    return {
      token,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cookie: `jwt=${token}`
    };
  }

  getAuthForMethod(method, options = {}) {
    switch (method) {
      case AUTH_METHODS.LOCAL:
        return this.getBasicAuth();
      case AUTH_METHODS.JWT:
        return this.getJwtAuth(options.userPayload);
      case AUTH_METHODS.API_KEY:
        return this.getApiKeyAuth();
      case 'bulk':
        return this.getBulkDownloadAuth();
      default:
        throw new Error(`Unknown auth method: ${method}`);
    }
  }

  getCredentialsForEndpoint(endpoint) {
    const publicEndpoints = ['/api/catalog', '/api/news'];
    const jwtOnlyEndpoints = ['/api/user/updateinfo', '/api/user/generateapikey', '/api/user/getcart'];
    const localOnlyEndpoints = ['/api/user/signin'];
    const bulkEndpoints = ['/api/data/bulk-download'];

    if (publicEndpoints.some(path => endpoint.includes(path))) {
      return null;
    }

    if (bulkEndpoints.some(path => endpoint.includes(path))) {
      return this.getBulkDownloadAuth();
    }

    if (jwtOnlyEndpoints.some(path => endpoint.includes(path))) {
      return this.getJwtAuth();
    }

    if (localOnlyEndpoints.some(path => endpoint.includes(path))) {
      return this.getBasicAuth();
    }

    return this.getJwtAuth();
  }
}

const authHelper = new TestAuthHelper();

module.exports = {
  TestAuthHelper,
  authHelper,
  getBasicAuth: () => authHelper.getBasicAuth(),
  getBulkDownloadAuth: () => authHelper.getBulkDownloadAuth(),
  getApiKeyAuth: () => authHelper.getApiKeyAuth(),
  getJwtAuth: (userPayload) => authHelper.getJwtAuth(userPayload),
  getAuthForMethod: (method, options) => authHelper.getAuthForMethod(method, options),
  getCredentialsForEndpoint: (endpoint) => authHelper.getCredentialsForEndpoint(endpoint)
};