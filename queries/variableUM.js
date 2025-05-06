const { variableCatalogUnstructuredMetadata } = require('./variableCatalog');

const makeVariableUMQuery = (shortname) =>
  `SELECT
     Variable,
     Unstructured_Variable_Metadata
     FROM (${variableCatalogUnstructuredMetadata}) cat
     WHERE Dataset_Short_Name='${shortname}'`;

module.exports.makeVariableUMQuery = makeVariableUMQuery;
