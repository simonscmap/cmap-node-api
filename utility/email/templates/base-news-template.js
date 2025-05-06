const fs = require('fs');
const path = require('path');

// read the template from file and export as a string
// as a string it is renderable with the mustache library

const pathToBaseTemplate = path.resolve(
  __dirname,
  'mustache',
  'baseNews.mustache',
);

const baseTemplate = fs.readFileSync(pathToBaseTemplate, 'utf8');

module.exports = baseTemplate;
