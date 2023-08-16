const directQuery = require('../../utility/directQuery');
const initializeLogger = require("../../log-service");
const { getDatasetId } = require("../../queries/datasetId");
const { makeDatasetFullPageQuery } = require("../../queries/datasetFullPageQuery")

const moduleLogger = initializeLogger("controllers/catalog/fetchDataset");

// fetcheDataset :: { shortname?, id? } -> [errorMessage?, dataset?]
const fetchDataset = async ({ shortname, id }) => {
  let log = moduleLogger;

  let datasetId;
  if (id) {
    datasetId = id;
  } else if (shortname) {
    // getDataset id is cached with 60min ttl
    datasetId = await getDatasetId (shortname, log);
    if (!datasetId) {
      return [`could not resolve dataset id from shortname ${shortname}`];
    }
  } else {
    return ['insufficient args: neither shortname nor id provided'];
  }

  let query = makeDatasetFullPageQuery (datasetId);
  let options = { description: 'query dataset'};

  let [error, result] = await directQuery (query, options, log);

  if (!error) {
    // TODO parse result
    return [null, result.recordset[0]];
  }
  return [error];
}

module.exports = fetchDataset;
