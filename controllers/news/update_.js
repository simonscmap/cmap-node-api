const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const getTags = require("../notifications/getTags")
const initializeLogger = require("../../log-service");
const { safePath, safePathOr } = require("../../utility/objectUtils");

const log = initializeLogger("controllers/news/update");

const updateQuery = `UPDATE [Opedia].[dbo].[tblNews]
      SET
        headline = @headline,
        link = @link,
        label = @label,
        body = @body,
        date = @date,
        rank = @rank,
        view_status = @view_status,
        modify_date = @modify_date,
        UserID = @UserId
      WHERE ID = @id;
`;

const tagInsertTemplate = (newsId, datasetName) =>
        `INSERT INTO tblNews_Datasets (News_ID, Dataset_ID)
         SELECT ${newsId}, ID FROM tblDatasets
         WHERE Dataset_Name='${datasetName}';`;

const getTagInsertQuery = (tags = [], existingTags = [], newsId) => tags
      .filter ((tag) => !existingTags.includes (tag))
      .map ((tag) => tagInsertTemplate (newsId, tag))
      .join (' ');

const tagDeleteTemplate = (newsId, datasetName) =>
        `DELETE FROM tblNews_Datasets
         WHERE News_ID = ${newsId}
         AND Dataset_ID = (SELECT ID FROM tblDatasets WHERE Dataset_Name='${datasetName}');`;

const getTagDeleteQuery = (tags = [], existingTags = [], newsId) => existingTags
      .filter ((existingTag) => !tags.includes (existingTag))
      .map ((tag) => tagDeleteTemplate (newsId, tag))
      .join (' ');




const requiredKeys = [
  "id",
  "headline",
  // "label", // not required
  "link",
  "body",
  "date",
  // "rank",   // not required -- will be null if no rank
  "view_status", // view_status is set to 0 on create, and updated later
  // "statusId",    // not required, default to 0
  "tags",
];

const validateBody = (body) => {
  let parsedBody;
  try {
    parsedBody = JSON.stringify(JSON.parse(body));
  } catch (e) {
    return [e];
  }
  return [false, parsedBody];
}

const keyIsSet = safePathOr (false) ((value) => value !== undefined && value !== null);

/* CONTROLLER */
const updateController = async (req, res) => {
  log.info("updating news story", { ...req.body });

  const missingKeys = requiredKeys.filter((key) =>
    !keyIsSet (['story', key]) (req.body));

  if (missingKeys.length > 0) {
    log.error("missing fields", missingKeys);
    return res.status(400)
      .send(`Bad request: missing fields ${missingKeys.join(",")}`);
  }

  const { story } = req.body;

  // generate queries
  const { id: newsId, tags } = story;

  const [invalidBody, parsedBody] = validateBody (story.body);
  if (invalidBody) {
    log.error ('Invalid JSON body', invalidBody);
    return res.status(400).send ('Story body is invalid JSON');
  }

  // get existing tags
  const [tagFetchErr, storyTags] = await getTags (newsId, log);
  if (tagFetchErr) {
    log.error ('failed to get tags for story during update', { newsId });
    return res.status(500).send ('Error reconciling tags during update');
  }

  const existingTags = storyTags.map (({ Dataset_Name }) => Dataset_Name);
  const tagInsertQuery = getTagInsertQuery (tags, existingTags, newsId);
  const tagDeleteQuery = getTagDeleteQuery (tags, existingTags, newsId);

  let queries = updateQuery + tagInsertQuery + tagDeleteQuery;

  // create new request
  const writePool = await pools.userReadAndWritePool;
  const request = new sql.Request(writePool);

  // input
  request.input("id", sql.Int, story.id);
  request.input("headline", sql.NVarChar, story.headline);
  request.input("link", sql.NVarChar, story.link);
  request.input("label", sql.VarChar, story.label);
  request.input("body", sql.NVarChar, parsedBody);
  request.input("date", sql.NVarChar, story.date);
  request.input("rank", sql.Int, story.rank);
  request.input("view_status", sql.Int, story.view_status);
  request.input("modify_date", sql.DateTime, (new Date()).toISOString());
  request.input("UserId", sql.Int, req.user.id);
  request.input("statusId", sql.Int, story.statusId);

  // execute
  let response;
  try {
    response = await request.query (queries);
  } catch (e) {
    log.error ('failed to update news story', { error: e, story });
    return res.status (500).send ('Error updating story');
  }

  log.trace ('update response', response);

  log.info ('success updating news story', { storyId: story.id });
  return res.sendStatus (200);

};

module.exports = updateController;
