const fetch = require('isomorphic-fetch');
const fetchDataset = require('./fetchDataset');
const cacheAsync = require("../../utility/cacheAsync");
const { safePath } = require("../../utility/objectUtils");

const logInit = require("../../log-service");

const moduleLogger = logInit("controllers/catalog/recs");

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

// given a list of table names, fetch full page data for each
const fetchAndProcessDatasetsByTable = async (tableNames = []) => {
  const fetchJobs = tableNames.map(fetchDataset);

  let fetchedDatasets;
  try {
    fetchedDatasets = await Promise.all (fetchJobs);
  } catch (e) {
    moduleLogger.error ('error fetching full dataset data', { error: e });
    return ['error fetching full dataset data'];
  }

  const responseData = fetchedDatasets.reduce ((acc, curr, index) => {
    const [err, dataset] = curr;
    if (err) {
      moduleLogger.trace ('excluding error result from rec datasets', { err });
      return acc;
    }
    return [...acc, dataset];
  }, [])

  return [null, responseData];
}

const safelyGetResponseJson = async (resp) => {
  if (!resp.ok) {
    const errorMessage = `validation service responded with ${resp.status}`;
    moduleLogger.error (errorMessage, { responseText: resp.statusText });
    return [new Error (errorMessage)];
  }

  let data;
  try {
    data = await resp.json ();
  } catch (e) {
    moduleLogger.error ('error parsing response for popular datasets', { error: e, respKeys: Object.keys(resp), response: resp });
    return [e]
  }

  if (data.error) {
    moduleLogger.error ('validation api returned error', { error: data.error });
    return ['validation api returned error'];
  }

  return [null, data];
}




/* Popular Datasets */
const fetchPopularDatasetsFromValidationAPI = async () => {
  const endpoint = 'https://cmapdatavalidation.com/ml/recommend/popular';
  let response;
  try {
    response = await fetch (endpoint);
  } catch (e) {
    moduleLogger.error ('error fetching popular datasets', { error: e });
    return [e];
  }

  const [err, data] = await safelyGetResponseJson (response);
  if (err) {
    return [err];
  }

  const tableNames = Object.entries (data.data).map (([,tablename]) => ({ tablename }));

  const [fetchErr, result] = await fetchAndProcessDatasetsByTable (tableNames);
  if (fetchErr) {
    return [fetchErr];
  }

  return [null, result];
}

const fetchPopularDatasetsWithCache = async () =>
  await cacheAsync ('POPULAR_DATASETS',
                    fetchPopularDatasetsFromValidationAPI,
                    { ttl: ONE_DAY_IN_SECONDS });

module.exports.popularDatasets = async (req, res, next) => {
  const responseData = await fetchPopularDatasetsWithCache ();

  if (responseData) {
    res.json (responseData);
    next ();
  } else {
    res.status(500).send ();
    next ('error resolving popular datasets');
  }
}


/* Recent Datasets */
const fetchRecentDatasetsFromValidationAPI = async (userId) => {
  const endpoint = `https://cmapdatavalidation.com/ml/recommend/again?user_id=${userId}`;
  let response;
  try {
    response = await fetch (endpoint);
  } catch (e) {
    moduleLogger.error ('error fetching recent datasets', { error: e });
    return [e];
  }

  const [err, data] = await safelyGetResponseJson (response);
  if (err) {
    return [err];
  }

  const tableNames = Object.entries (data.data).map (([,tablename]) => ({ tablename }));

  const [fetchErr, result] = await fetchAndProcessDatasetsByTable (tableNames);
  if (fetchErr) {
    return [fetchErr];
  }

  return [null, result];
}

module.exports.recentDatasets = async (req, res, next) => {
  const { user_id } = req.query;
  const [err, responseData] = await fetchRecentDatasetsFromValidationAPI (user_id);

  if (responseData) {
    res.json (responseData);
    next ();
  } else {
    res.status(500).send ();
    next ('error resolving recent datasets');
  }
}



/* Recommended Datasets */
const fetchRecommendedDatasetsFromValidationAPI = async (userId) => {
  const endpoint = `https://cmapdatavalidation.com/ml/recommend/also?user_id=${userId}`;
  let response;
  try {
    response = await fetch (endpoint);
  } catch (e) {
    moduleLogger.error ('error fetching similar datasets', { error: e });
    return [e];
  }

  const [err, data] = await safelyGetResponseJson (response);
  if (err) {
    return [err];
  }

  const tableNames = Object.entries (data.data).map (([,tablename]) => ({ tablename }));

  const [fetchErr, result] = await fetchAndProcessDatasetsByTable (tableNames);
  if (fetchErr) {
    return [fetchErr];
  }

  return [null, result];
}

module.exports.recommendedDatasets = async (req, res, next) => {
  const { user_id } = req.query;
  const [err, responseData] = await fetchRecommendedDatasetsFromValidationAPI (user_id);

  if (responseData) {
    /* moduleLogger.debug ('response data for SEE ALSO', responseData.length);
* const report = responseData.map (({ Dataset_ID, Keywords, Sensors, Short_Name }) => ({
*   id: Dataset_ID,
*   shortName: Short_Name,
*   keywordsCount: Keywords.split(',').length,
*   keywordsStrLen: Keywords.length,
*   sensorsCount: Sensors.split(',').length,
*   sensorsStrLen: Sensors.length,
* }));

* console.table(report); */

    res.json (responseData);
    next ();
  } else {
    res.status(500).send ();
    next ('error resolving recommended datasets');
  }
}
