const directQuery = require('../../utility/directQuery');
const initializeLogger = require("../../log-service");
const { getDatasetId } = require("../../queries/datasetId");
const { makeDatasetFullPageQuery } = require("../../queries/datasetFullPageQuery")
const { makeDatasetQuery } = require("../../queries/makeDatasetQuery")
const {
  fetchDatasetIdsWithCache,
} = require("../../utility/router/queries");

const moduleLogger = initializeLogger("controllers/catalog/fetchDataset");

// Find the Dataset Id among an array of table/id tuples matching a provided table
// getDatasetIdFromTableName :: Table Name -> [ { Table_Name, Dataset_ID } ] -> Null | Dataset ID
const getDatasetIdFromTableName = (tableName, ids) => {
  if (typeof tableName !== 'string' || !Array.isArray(ids)) {
    return null;
  }

  let record = ids.find(({ Table_Name }) => {
    if (Table_Name.toLowerCase() === tableName.toLowerCase()) {
      return true;
    }
    return false;
  });

  if (record) {
    return record.Dataset_ID;
  } else {
    return null;
  }
}

// fetcheDataset :: { shortname?, id?, tablename? } -> [errorMessage?, dataset?]
const fetchDataset = async ({ shortname, id, tablename }, options = {}) => {
  let log = moduleLogger;

  const { useNewDatasetModel } = options

  let datasetId;
  if (id) {
    datasetId = id;
  } else if (shortname) {
    // getDataset id is cached with 60min ttl
    datasetId = await getDatasetId (shortname, log);
    if (!datasetId) {
      return [`could not resolve dataset id from shortname ${shortname}`];
    }
  } else if (tablename) {
    let datasetIds = await fetchDatasetIdsWithCache();
    datasetId = getDatasetIdFromTableName(tablename, datasetIds);
  } else {
    return ['insufficient args: neither shortname nor id provided'];
  }

  if (!datasetId) {
    return ['unable to determine dataset id'];
  }

  let query;
  if (useNewDatasetModel) {
    query = makeDatasetQuery (datasetId);
  } else {
    query = makeDatasetFullPageQuery (datasetId);
  }

  let directQueryOptions = { description: 'query dataset'};

  let [error, result] = await directQuery (query, directQueryOptions, log);

  if (!error) {
    return [null, result.recordset[0]];
  }
  return [error];
}

module.exports = fetchDataset;
