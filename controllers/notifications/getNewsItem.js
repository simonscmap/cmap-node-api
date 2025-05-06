const directQuery = require('../../utility/directQuery');
const initializeLogger = require('../../log-service');
const { safePathOr } = require('../../utility/objectUtils');

const moduleLogger = initializeLogger('controllers/notifications/getNewsItem');

const storyOrNull = safePathOr(null)((thing) => thing && thing.headline)([
  'recordset',
  0,
]);

const getNewsItem = async (newsId, log = moduleLogger) => {
  const query = `SELECT * FROM tblNews WHERE ID=${newsId}`;
  const options = {
    description: 'get news item',
    poolName: 'rainier',
  };

  const [err, resp] = await directQuery(query, options, log);

  if (err) {
    log.error('error fetching news item', err);
    return [err];
  }

  const result = storyOrNull(resp);

  if (!result) {
    return [true];
  }

  const newsItem = { ...result };

  try {
    newsItem.body = JSON.parse(newsItem.body);
  } catch (e) {
    return [e];
  }

  return [null, newsItem];
};

module.exports = getNewsItem;
