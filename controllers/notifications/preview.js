const initializeLogger = require("../../log-service");
const {
  generalNewsNotification,
  datasetUpdateNotification
} = require("../../utility/email/templates");
const { preRenderBody } = require("./preRender");
const getNewsItem = require("./getNewsItem");
const getTagsForNewsItem = require("./getTags");

const moduleLogger = initializeLogger("controllers/notifications/preview");

const renderNotification = (template) =>
      (headline = '', body, tags, emailId, log = moduleLogger) => {
        const [preRenderErr, preRender] = preRenderBody (body, log);

        if (preRenderErr) {
          log.error ('error prerendering notification preview', preRenderErr);
          return '';
        }

        return template ({
          headline,
          body: preRender,
          tags,
          emailId,
        });
      }

const renderGeneralNews = renderNotification (generalNewsNotification);
const renderDatasetUpdate = renderNotification (datasetUpdateNotification);

/**
 * preview controller
 * returns an array of preview object containing html
 */
const preview = async (req, res) => {
  const log = moduleLogger.setReqId (req.requestId);
  log.debug ('generating notification preview');

  const newsId = req.query.newsId;
  if (!newsId) {
    log.error ('no news id provided', { qs: req.query });
    return res.status (400).send ('No newsId provided');
  }

  const [ tagsErr, tags ] = await getTagsForNewsItem (newsId, log);
  const [ newsErr, news ] = await getNewsItem (newsId, log);

  if (tagsErr || newsErr) {
    log.error ('error generating notification preview', [tagsErr, newsErr]);
    return res.status(500).send ('Error generating preview');
  }

  const { headline, body } = news;

  const previews = [
    {
      newsId,
      subject: headline,
      content: renderGeneralNews (headline, body, tags, 'preview', log),
    },
    // {
    //   newsId,
    //   subject: headline,
    //   content: renderDatasetUpdate (headline, body, tags, 'preview', log),
    // }
  ];

  return res.json (previews);
}


module.exports = {
  controller: preview,
  renderGeneralNews,
  renderDatasetUpdate,
};
