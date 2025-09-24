require('dotenv').config();

function validateEnvironmentAuth() {
  const missingVars = [];

  if (!process.env.TEST_USER_EMAIL) missingVars.push('TEST_USER_EMAIL');
  if (!process.env.TEST_USER_PASSWORD) missingVars.push('TEST_USER_PASSWORD');
  if (!process.env.BULK_DOWNLOAD_TEST_EMAIL) missingVars.push('BULK_DOWNLOAD_TEST_EMAIL');
  if (!process.env.BULK_DOWNLOAD_TEST_PASSWORD) missingVars.push('BULK_DOWNLOAD_TEST_PASSWORD');

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables for test authentication: ${missingVars.join(', ')}`);
  }
}

function getTestUserCredentials() {
  validateEnvironmentAuth();
  return {
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD,
    apiKey: process.env.TEST_API_KEY
  };
}

function getBulkDownloadCredentials() {
  validateEnvironmentAuth();
  return {
    email: process.env.BULK_DOWNLOAD_TEST_EMAIL,
    password: process.env.BULK_DOWNLOAD_TEST_PASSWORD
  };
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return process.env.JWT_SECRET;
}

module.exports = {
  validateEnvironmentAuth,
  getTestUserCredentials,
  getBulkDownloadCredentials,
  getJwtSecret
};