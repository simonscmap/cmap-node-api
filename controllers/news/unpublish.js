const queryDefinition = require('./queryDefinitions/unpublish');
const { generateController } = require('../futureController');

module.exports = generateController(queryDefinition);
