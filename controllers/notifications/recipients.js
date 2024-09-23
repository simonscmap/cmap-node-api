const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");
const { safePath } = require("../../utility/objectUtils");

const moduleLogger = initializeLogger("controllers/notifications/recipients");
// temprorary cache

// :: { tags, emailId } -> [ { userId, datasetId } ]
const fetchProjected = async (tags, log = moduleLogger) => {
  if (!Array.isArray(tags)) {
    return [true];
  }

  const dl = tags.map (d => `'${d}'`).join (', ');
  //
  let query = 'SELECT UserID, Email from tblUsers WHERE News_Subscribed=1';

  if (tags.length) {
    query += `
    SELECT User_ID, Dataset_ID, Dataset_Name, Email
    FROM tblDataset_Subscribers
    JOIN tblUsers ON User_ID = UserID
    WHERE Dataset_Name IN (${dl});
    `;
  }

  const options = {
    description: "get recipients of an email based on tagged datasets",
    poolName: 'rainierReadWrite',
  };

  const [err, resp] = await directQuery (query, options, log);

  log.debug ('result from recipient projection', { tags, resp });

  if (err) {
    return [err, null];
  }

  const result = safePath (['recordsets']) (resp)

  // Normalize
  const newsSubscribers = (result[0]).map (r =>
    ({ userId: r.UserID, email: r.Email }))
  const subscribed = (result[1] || []).map (r =>
    ({ userId: r.User_ID, email: r.Email, datasetName: r.Dataset_Name }))

  if (result) {
    const payload = {
      subscribed,
      newsSubscribers,
    }
    return [null, payload];
  }

  log.debug ('no recordsets returned', { tags, result, resp });
  return [true, result];
};

// Get number of actual recipients for a sent email
// ::  emailId  => Integer
const fetchPastActual = async (emailId) => {
  const log = moduleLogger;
  const constraint = emailId ? `WHERE Email_ID = ${emailId}` : '';
  const query = `SELECT * FROM tblEmail_Recipients ${constraint}`;
  const options = {
    description: "get recipients of sent email(s)",
    poolName: 'rainierReadWrite',
  };

  const [err, resp] = await directQuery (query, options, log)

  if (err) {
    return [err, null];
  }

  const result = safePath (['recordset']) (resp);
  const payload = Array.isArray (result) && result.reduce ((acc, curr) => {
    if (!curr.Email_ID) {
      return acc;
    }
    if (Array.isArray (acc[curr.Email_ID])) {
      acc[curr.Email_ID].push (curr.User_ID);
    } else {
      acc[curr.Email_ID] = [curr.User_ID];
    }
    return acc;
  }, {});

  return [null, payload];

};

const controller = async (req, res) => {
  const log = moduleLogger.setReqId (req.requestId);

  let tagsArg;
  try {
    const result = JSON.parse (req.query.tags);
    if (Array.isArray (result)) {
      tagsArg = result;
    }
  } catch (e) {
    log.debug ('could not resolve tags args from request query string', { query: req.query });
  }

  const emailId = req.query.emailId;


  const payload = {};
  const errors = [];

  const removeEmail = ({ userId, datasetName, email }) => ({ userId, datasetName })

  if (tagsArg) {
    log.debug ('fetching projection for tags', { tagsArg })
    const [err, projection] = await fetchProjected (tagsArg, log);
    if (err) {
      errors.push (err);
    } else if (projection) {
      payload.projection = {
        subscribed: projection.subscribed.map (removeEmail),
        newsSubscribers: projection.newsSubscribers.map (removeEmail),
      }
    }
  }

  if (emailId) {
    const [err, actual] = await fetchPastActual (emailId);
    if (err) {
      errors.push (err);
    } else if (actual) {
      payload.actual = actual;
    }
  }

  if (errors.length) {
    return res.sendStatus (500);
  } else {
    return res.json (payload);
  }

};

module.exports = {
  fetchProjected,
  fetchPastActual,
  controller,
};
