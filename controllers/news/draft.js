const queryDefinition = require('./queryDefinitions/draft');
const { generateController } = require('../futureController');

module.exports = generateController(queryDefinition);
