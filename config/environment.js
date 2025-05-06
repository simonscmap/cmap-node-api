const isProduction =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

const isDevelopment = process.env.NODE_ENV === 'development';

module.exports = {
  isProduction,
  isDevelopment,
  NODE_ENV: process.env.NODE_ENV,
};
