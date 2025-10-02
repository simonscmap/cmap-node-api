const AUTH_METHODS = {
  LOCAL: 'local',
  JWT: 'jwt',
  API_KEY: 'headerapikey',
  GUEST: 'guest',
  BROWSER_ONLY: 'browseronly'
};

const AUTH_METHOD_IDS = {
  [AUTH_METHODS.LOCAL]: 1,
  [AUTH_METHODS.JWT]: 2,
  [AUTH_METHODS.API_KEY]: 3
};

const COMMON_STRATEGIES = {
  MULTI_METHOD: ['headerapikey', 'jwt', 'guest'],
  JWT_ONLY: ['jwt'],
  API_KEY_ONLY: ['headerapikey'],
  LOCAL_ONLY: ['local']
};

module.exports = {
  AUTH_METHODS,
  AUTH_METHOD_IDS,
  COMMON_STRATEGIES
};