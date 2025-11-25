module.exports = {
  secret: process.env.JWT_SECRET,
  expiresIn: '24h',
  cookieMaxAgeMs: 1000 * 60 * 60 * 24,
};
