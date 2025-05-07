const directQuery = require('../../utility/directQuery');
const cacheAsync = require('../../utility/cacheAsync');
const { safePath } = require('../../utility/objectUtils');
const logInit = require('../../log-service');
const moduleLogger = logInit('controllers/catalog');

const fetch = async () => {
  let log = moduleLogger;
  const query = 'SELECT Dataset_Name, Dataset_Long_Name, ID FROM tblDatasets';
  const options = {
    description: 'get a full list of short names',
  };
  const [err, resp] = await directQuery(query, options, log);
  if (err) {
    return [err, []]; // return empty list if error
  }
  const result = safePath(['recordset'])(resp);
  return [null, result];
};

const cacheKey = 'DATASET_NAMES_FULL_LIST';
// NOTE on options:
// use rainier because these names will be matched with the dataset tags
// fetched on rainier; otherwise some dataset ids will vary
const options = {
  ttl: 60 * 60 * 24,
  poolName: 'rainier',
}; // 1 day
const cachedFetch = async () => cacheAsync(cacheKey, fetch, options);

const controller = async (req, res, next) => {
  const log = moduleLogger.setReqId(req.requestId);
  log.trace('resolving dataset names');
  const result = await cachedFetch();
  if (!result || result.length == 0) {
    log.error('error retrieving dataset names');
    return res.sendStatus(500);
  } else if (result) {
    return res.json(result);
  } else {
    log.error('unknown errer retrieving dataset names', { err, result });
    return res.sendStatus(400);
  }
};

module.exports = {
  fetch,
  cachedFetch,
  controller,
};
