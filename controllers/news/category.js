const queryDefinition = require('./queryDefinitions/category');
const { generateController } = require('../futureController');

module.exports = generateController(queryDefinition);
