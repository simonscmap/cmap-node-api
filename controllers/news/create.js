const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/news/create');

/*
   This controller creates a new News Item in tblNews

   Peculiarities:

   - the client specifies the ID (which is not auto-incremented)
   - view_status will be automatically set to 'draft' for create items;
     thus creating a news story will never publish it, that must be a
     separate action

     - view_status:
     0 HIDDEN (not returned from the api)
     1 DRAFT
     2 PREVIEW
     3 PUBLISHED


 */

const query = `INSERT INTO [Opedia].[dbo].[tblNews]
      (id, headline, link, label, body, date, rank, view_status, create_date, UserID, Status_ID)
      OUTPUT Inserted.ID
      VALUES (
         @ID
       , @headline
       , @link
       , @label
       , @body
       , @date
       , @rank
       , @view_status
       , @create_date
       , @UserId
       , @statusId
      )`;

const requiredKeys = [
  // "id",
  'headline',
  // "label",
  'link',
  'body',
  'date',
  // "rank", // ranks are set on update, not on create
  // "view_status", // view_status is set to 0 on create, and updated later
  // "statusId", // not required, default to 0
  'tags',
];

module.exports = async (req, res) => {
  log.info('request for create news story', { ...req.body });

  if (!req.body.story) {
    log.warn('no data provided', { reqBody: req.body });
    res.status(400).send("Bad request: no 'story' data provided");
    return;
  }

  let story = req.body.story;

  let missingKeys = requiredKeys.filter((key) => {
    if (!story[key]) {
      return true;
    }
    return false;
  });

  if (missingKeys.length > 0) {
    log.info('missing fields', missingKeys);
    res
      .status(400)
      .send(`Bad request: missing fields ${missingKeys.join(',')}`);
    return;
  }

  let {
    headline,
    link,
    label = '',
    body,
    date,
    rank,
    view_status = 2,
    Status_ID = 0,
    tags,
  } = story;
  let createDate = new Date().toISOString();

  let parsedBody;
  try {
    // ensure valid json
    parsedBody = JSON.stringify(JSON.parse(body));
  } catch (e) {
    log.warn(
      'request to create news item provided invalid json for body field',
      { body },
    );
    res.status(400).send("Bad request: invalid json format for 'body' field");
    return;
  }

  log.trace('inserting new news item');

  // get the last id
  const readPool = await pools.dataReadOnlyPool;
  const idReq = new sql.Request(readPool);

  let nextId;
  try {
    const resp = await idReq.query(
      `SELECT TOP 1 ID FROM tblNews ORDER BY ID DESC`,
    );
    if (resp.recordset[0].ID) {
      nextId = 1 + resp.recordset[0].ID;
    }
  } catch (e) {
    log.error('error preparing new news item', { error: e });
    res.status(500).send('Error creating news item');
    return;
  }

  // create insert query
  const writePool = await pools.userReadAndWritePool;
  const request = new sql.Request(writePool);

  // input
  request.input('ID', sql.Int, nextId);
  request.input('headline', sql.NVarChar, headline);
  request.input('link', sql.NVarChar, link);
  request.input('label', sql.VarChar, label);
  request.input('body', sql.NVarChar, parsedBody);
  request.input('date', sql.NVarChar, date);
  request.input('rank', sql.Int, rank);
  request.input('view_status', sql.Int, view_status);
  request.input('create_date', sql.DateTime, createDate);
  request.input('UserId', sql.Int, req.user.id);
  request.input('statusId', sql.Int, Status_ID);

  let result;

  try {
    log.trace('executing news insert', query);
    result = await request.query(query);
  } catch (e) {
    log.error('error inserting new news item', { error: e });
    res.status(500).send('Error creating news item');
    return;
  }

  if (!result) {
    log.error('unknown error creating news item');
    res.sendStatus(500);
    return;
  } else {
    log.info('success creating news item', { result });
    res.status(200).send(result.recordset);
  }

  log.trace("inserting news item's tagged datasets", { result, tags, nextId });

  const tagRequest = new sql.Request(writePool);
  const template = (newsId, datasetName) =>
    `INSERT INTO tblNews_Datasets (News_ID, Dataset_ID)
         SELECT ${newsId}, ID FROM tblDatasets
         WHERE Dataset_Name='${datasetName}';`;
  const tagInsertQuery = tags.map((tag) => template(nextId, tag)).join(' ');

  let tagInsertResp;
  try {
    tagInsertResp = await tagRequest.query(tagInsertQuery);
  } catch (e) {
    log.error('error inserting news item tags', { error: e });
    return;
  }

  log.info('success inserting news tags', tagInsertResp);
  return;
};
