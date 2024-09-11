// const sql = require("mssql");
const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");
const { safePathOr } = require("../../utility/objectUtils");
const { fetchProjected } = require ("./recipients");
const templates = require("../../utility/email/templates");
const { preRenderBody } = require("./preRender");

const moduleLogger = initializeLogger("controllers/notifications/preview");

const safePathOrEmptyArray = safePathOr ([]) (Array.isArray);


const getTagsForNewsItem = async (newsId, log) => {
  const query = `
SELECT Dataset_ID, Dataset_Name FROM tblNews_Datasets
LEFT JOIN tblDatasets on Dataset_ID=ID
WHERE News_ID=${newsId}
`;
  const options = {
    description: "get tagged datasets for news item",
    poolName: 'rainier',
  };
  const [err, resp] = await directQuery (query, options, log);
  if (err) {
    return [err];
  }
  const result = safePathOrEmptyArray (['recordset']) (resp);
  return [null, result];
}


const getNewsItem = async (newsId, log) => {
  const query = `SELECT body, headline, link FROM tblNews WHERE ID=${newsId}`;
  const options = {
    description: "get news item",
    poolName: 'rainier',
  };
  const [err, resp] = await directQuery (query, options, log);
  if (err) {
    log.error ('error fetching news item', err)
    return [err];
  }
  log.debug ('news fetch resp', resp)
  const result = safePathOr (null) (thing => thing && thing.headline) (['recordset', 0]) (resp);

  if (!result) {
    return [true];
  }

  const newsItem = {...result};
  try {
    newsItem.body = JSON.parse (newsItem.body);
  } catch (e) {
    return [e];
  }

  return [null, newsItem];
}



/**
 * preview controller
 * returns an array of html
 */
const preview = async (req, res) => {
  const log = moduleLogger.setReqId (req.requestId);
  log.debug ('genereating notification preview');

  const newsId = req.query.newsId;
  if (!newsId) {
    log.error ('no news id provided', { qs: req.query });
    return res.status (400).send ('No newsId provided');
  }

  const [ tagsErr, tags ] = await getTagsForNewsItem (newsId, log);
  const [ recipErr, recipients ] = await fetchProjected ({ tagSet: tags });
  const [ newsErr, news ] = await getNewsItem (newsId, log);

  const [preRenderErr, preRender] = preRenderBody (news.body, log);


  const previews = [];

  // generate content
  const content =  templates.generalNewsNotification({
    headline: news && news.headline,
    body: preRender,
    tags,
  });

  // TODO handle multiple previews

  return res.json ([ { newsId, content } ]);
}


module.exports = preview;
