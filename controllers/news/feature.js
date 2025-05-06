const queryDefinition = require('./queryDefinitions/feature');
const { generateController } = require('../futureController');

module.exports = generateController(queryDefinition);
