const directQuery = require("../../utility/directQuery");
const initializeLogger = require("../../log-service");

const moduleLogger = initializeLogger("controllers/notifications/insertRecipients");

const success = (userId, emailId) =>
      `INSERT INTO tblEmail_Recipients
       (User_ID, Email_ID, Success)
       VALUES
       (
         ${userId},
         ${emailId},
         1
       )`;

const failure = (userId, emailId) =>
      `INSERT INTO tblEmail_Recipients
       (User_ID, Email_ID, Success)
       VALUES
       (
         ${userId},
         ${emailId},
         0
       )`;

const generateQuery = (recipientResults) => {
  return recipientResults
    .filter (r => r.userId)
    .map ((result) => {
    if (result.success) {
      return success (result.userId, result.emailId);
    } else {
      return failure (result.userId, result.emailId);
    }
  }).join ('; ');
};


const getUsersByEmail = async (recipients) => {
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
      const match = resp.recordset.find ((record) => record.Email === r.recipient);
      return {
        ...r,
        userId: match ? match.UserId : null,
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

  const options = {
    description: "insert email notification recipients",
    poolName: 'rainierReadWrite',
  };

  const query = generateQuery (recipientsWithId);

  const [err, resp] = await directQuery (query, options, log);

  // here we're going to throw, because the consumer of this function is going to wrap
  // it in a promise; a thrown error will trigger the reject path
  if (err) {
    log.error ('error inserting recipients', err)
    throw new Error ('error inserting recipients');
  }

  return recipients;
}

module.exports = insertRecipients;
