const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");
const { safePath } = require("../../utility/objectUtils");
const generateKey = require ("./generateKey")

const moduleLogger = initializeLogger("controllers/notifications/recipients");
// temprorary cache

const cache = new Map ();

// :: { tags, emailId } -> [ { userId, datasetId } ]
const fetchProjected = async (args) => {
  const log = moduleLogger;

  const { tagSet } = args;

  if (!Array.isArray(tagSet)) {
    return [true];
  }

  const normalizedKey = generateKey (tagSet);

  if (cache.has (normalizedKey)) {
    // console.log ('cache hit for projected recipients', normalizedKey)
    // return cache.get (normalizedKey);
  }

  const dl = tagSet.map (d => `'${d}'`).join (', ');
  //
  let query = 'SELECT UserID from tblUsers WHERE News_Subscribed=1';

  if (tagSet.length) {
    query += `
    SELECT User_ID, Dataset_ID, Dataset_Name
    FROM tblDataset_Subscribers
    WHERE Dataset_Name IN (${dl});
    `;
  }

  const options = {
    description: "get recipients of an email based on tagged datasets",
    poolName: 'rainierReadWrite',
  };

  const [err, resp] = await directQuery (query, options, log);

  log.debug ('result from recipient projection', { tags: tagSet, resp });

  if (err) {
    return [err, null];
  }

  // TODO reconcile subscribed users with News Subscribers
  const result = safePath (['recordsets']) (resp)
  if (result) {
    const payload = {
      subscribed: result[1] || [],
      newsSubscribers: result[0],
    }
    // cache.set (normalizedKey, payload);
    return [null, payload];
  }

  log.debug ('no recordsets returned', { tagSet, result, resp });
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

  if (tagsArg) {
    log.debug ('fetching projection for tags', { tagsArg })
    const [err, projection] = await fetchProjected ({ tagSet: tagsArg });
    if (err) {
      errors.push (err);
    } else if (projection) {
      payload.projection = projection;
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
