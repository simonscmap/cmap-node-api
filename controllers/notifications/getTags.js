const directQuery = require('../../utility/directQuery');
const { safePathOr } = require('../../utility/objectUtils');
const initializeLogger = require('../../log-service');

const moduleLogger = initializeLogger('controllers/notifications/getTags');

const safePathOrEmptyArray = safePathOr([])(Array.isArray);

const getTagsForNewsItem = async (newsId, log = moduleLogger) => {
  const query = `
    SELECT Dataset_ID, Dataset_Name FROM tblNews_Datasets
    LEFT JOIN tblDatasets on Dataset_ID=ID
    WHERE News_ID=${newsId}
  `;
  const options = {
    description: 'get tagged datasets for news item',
    poolName: 'rainier',
  };
  const [err, resp] = await directQuery(query, options, log);
  if (err) {
    return [err];
  }
  const result = safePathOrEmptyArray(['recordset'])(resp);
  return [null, result];
};

module.exports = getTagsForNewsItem;
