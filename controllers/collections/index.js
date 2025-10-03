// This is the main collections controller index file
// Individual controllers will be added here as they are implemented

module.exports = {
  get: require('./get'),
  detail: require('./detail'),
  delete: require('./delete'),
  verifyName: require('./verifyName'),
  create: require('./create'),
};
