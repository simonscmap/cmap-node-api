const Sanctuary = require('sanctuary');
const { env } = require('fluture-sanctuary-types');
const S = Sanctuary.create({
  checkTypes: process.env === 'production' ? false : true,
  env: Sanctuary.env.concat(env),
});

module.exports = S;
