const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");
const env = require ('../../config/environment');
const moduleLogger = initializeLogger("controllers/notifications/insertRecipients");

const success = (userId, emailId, dateTime) =>
      `INSERT INTO tblEmail_Recipients
       (
         User_ID,
         Email_ID,
         Success,
         Attempt,
         Last_Attempt_Date_Time
       )
       VALUES
       (
         ${userId},
         ${emailId},
         1,
         1,
         '${dateTime}'
       )`;

const failure = (userId, emailId, dateTime) =>
      `INSERT INTO tblEmail_Recipients
       (User_ID, Email_ID, Success, Attempt, Last_Attempt_Date_Time)
       VALUES
       (
         ${userId},
         ${emailId},
         0,
         1,
         '${dateTime}'
       )`;

const generateQuery = (recipientResults, attemptDateTime) => {
  return recipientResults
    .filter (r => r.userId)
    .map ((result) => {
    if (result.success) {
      return success (result.userId, result.emailId, attemptDateTime);
    } else {
      return failure (result.userId, result.emailId, attemptDateTime);
    }
  }).join ('; ');
};


const getUsersByEmail = async (recipients = []) => {
  const emails = recipients.map (({ recipient }) => `'${recipient}'`).join (', ');
  const query = `SELECT UserId, Email from tblUsers
                 WHERE Email IN (${emails});`
  const options = {
    description: "get user ids by email",
    poolName: 'rainierReadWrite',
  };
  const [err, resp] = await directQuery (query, options);
  if (err) {
    return [true];
  }
  if (resp) {
    const updatedRecipients = recipients.map ((r) => {
      // try to match a recipient (email) with a user (id)
      const match = resp.recordset.find ((record) => record.Email === r.recipient);
      return {
        ...r,
        userId: match ? match.UserId : null, // can be null! especially for test emails
      }
    });
    return [false, updatedRecipients];
  } else {
    return [true];
  }
}


// :: [ { recipient, success, emailId }] ->
const insertRecipients = async (recipients, log = moduleLogger) => {
  log.info ('creating record of email recipients', { recipients });

  const [e, recipientsWithId] = await getUsersByEmail (recipients)
  if (e) {
    log.error ('error fetching user records', { recipients, error: e});
    throw new Error ('failed to fetch user records');
  }

  if (env.isDevelopment) {
    console.table (recipientsWithId);
  }

  const options = {
    description: "insert email notification recipients",
    poolName: 'rainierReadWrite',
  };

  const attemptDateTime = (new Date ()).toISOString();
  const query = generateQuery (recipientsWithId, attemptDateTime);

  const [err, resp] = await directQuery (query, options, log);

  // here we're going to throw
  // because the consumer of this function is going to wrap it in a promise;
  // a thrown error will trigger the reject path
  if (err) {
    log.error ('error inserting recipients', { error: err, query })
    throw new Error ('error inserting recipients');
  }

  log.info ('inserted email recipients', { recipients, rowsAffected: resp.rowsAffected })
  return recipients;
}

module.exports = insertRecipients;
