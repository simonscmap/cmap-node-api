const fetch = require('isomorphic-fetch');
const fetchDataset = require('./fetchDataset');
const cacheAsync = require("../../utility/cacheAsync");

const logInit = require("../../log-service");

const moduleLogger = logInit("controllers/catalog/recs");

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

  moduleLogger.trace ('success fetching datasets');

  return [null, responseData];
}

const safelyGetResponseJson = async (resp) => {
  let data;
  try {
    data = await resp.json ();
  } catch (e) {
    moduleLogger.error ('error parsing response for popular datasets', { error: e });
    return [e]
  }

  if (data.error) {
    moduleLogger.error ('validation api returned error', {  });
    return ['validation api returned error']
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
                    { ttl: 60 * 60 });

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
    res.json (responseData);
    next ();
  } else {
    res.status(500).send ();
    next ('error resolving recommended datasets');
  }
}
