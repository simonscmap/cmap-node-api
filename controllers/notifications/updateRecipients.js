const directQuery = require('../../utility/directQuery');
const initializeLogger = require('../../log-service');
const env = require('../../config/environment');
const moduleLogger = initializeLogger(
  'controllers/notifications/updateRecipients',
);

const success = (userId, emailId, dateTime) =>
  `UPDATE tblEmail_Recipients
       SET
        Success = 1,
        Attempt = Attempt + 1,
        Last_Attempt_Date_Time = '${dateTime}'
       WHERE User_ID = ${userId}
       AND Email_ID = ${emailId}`;

const failure = (userId, emailId, dateTime) =>
  `UPDATE tblEmail_Recipients
       SET
        Success = 0,
        Attempt = Attempt + 1,
        Last_Attempt_Date_Time = '${dateTime}'
       WHERE User_ID = ${userId}
       AND Email_ID = ${emailId}`;

const generateQuery = (recipientResults, attemptDateTime) => {
  return recipientResults
    .filter((r) => r.userId)
    .map((result) => {
      if (result.success) {
        return success(result.userId, result.emailId, attemptDateTime);
      } else {
        return failure(result.userId, result.emailId, attemptDateTime);
      }
    })
    .join('; ');
};

const getUsersByEmail = async (recipients) => {
  const emails = recipients.map(({ recipient }) => `'${recipient}'`).join(', ');
  const query = `SELECT UserId, Email from tblUsers
                 WHERE Email IN (${emails});`;
  const options = {
    description: 'get user ids by email',
    poolName: 'rainierReadWrite',
  };
  const [err, resp] = await directQuery(query, options);
  if (err) {
    return [true];
  }
  if (resp) {
    const fullRecipientRecords = recipients.map((r) => {
      // note: this can fail to find a matching user
      const match = resp.recordset.find(
        (record) => record.Email === r.recipient,
      );
      return {
        ...r,
        userId: match ? match.UserId : null,
      };
    });
    return [false, fullRecipientRecords];
  } else {
    return [true];
  }
};

// updateRecipients
// :: [ { recipient, success, emailId }] -> ()
const updateRecipients = async (recipients, log = moduleLogger) => {
  log.info('update records of email recipients', { recipients });

  const [e, recipientsWithId] = await getUsersByEmail(recipients);
  if (e) {
    log.error('error retrieving users by email', { recipients });
    throw new Error('could not retrieve recipient records');
  }

  if (env.isDevelopment) {
    console.table(recipientsWithId);
  }

  const options = {
    description: 'insert email notification recipients',
    poolName: 'rainierReadWrite',
  };

  const attemptDateTime = new Date().toISOString();
  const query = generateQuery(recipientsWithId, attemptDateTime);

  const [err, resp] = await directQuery(query, options, log);
  // here we're going to throw, because the consumer of this function
  // is going to wrap it in a promise;
  // a thrown error will trigger the reject path
  if (err) {
    log.error('error updating recipients', err);
    throw new Error('error updating recipients');
  }
  log.info('updated recipients', {
    rowsAffected: resp.rowsAffected,
    recipients,
  });

  return recipients;
};

module.exports = updateRecipients;
