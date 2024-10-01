const Future = require("fluture");
const dayjs = require("dayjs");
const directQuery = require("../utility/directQuery");
const initializeLogger = require("../log-service");
const { getServiceMailThreads } = require("../utility/email/getMail");
const { safePathOr, safePath } = require("../utility/objectUtils");

const log = initializeLogger ('mail-service/checkBouncedMail');

// capture group will be index 1 of result
const captureOrNull = safePathOr (null) ((match) => typeof match === 'string') ([1]);

// fetch sent email records that match selected email ids
const getEmailRecords = async (emailIds) => {
  const twentyMinutesAgo = dayjs ().subtract (20, 'm').toISOString();
  const timeConstraint = `Date_Time >= '${twentyMinutesAgo}'`
  const emailConstraint = emailIds.length ? `WHERE Email_ID IN (${emailIds.join (', ')})` : '';

  const constraint = emailIds.length
        ? `${emailConstraint} OR ${timeConstraint}`
        : `WHERE ${timeConstraint}`;
  const query = `SELECT es.Email_ID, es.Date_Time, es.Subject, la.Last_Attempt
       FROM tblEmail_Sent es
       CROSS APPLY (
         SELECT TOP 1 Last_Attempt_Date_Time as Last_Attempt
         FROM tblEmail_Recipients er
         WHERE er.Email_ID = es.Email_ID
       ) la
       ${constraint};`

  const options = {
    description: "get emails sent",
    poolName: 'rainier', // read only
  };
  const [err, result] = await directQuery (query, options);
  if (err) {
    return [err];
  }
  if (result && result.recordset) {
    return [false, result.recordset];
  }
  return [true];
};



const extractToHeader = (message) => {
  const headers = safePath (['payload', 'headers']) (message);

  if (!headers) {
    return null;
  }

  const recipients = headers
        .filter(({ name }) => name === 'To')
        .map (({ value }) => value);

  const recipient = recipients.length && recipients[0];

  return recipient || null;
}

// get email id from message
const extractEmailId = (message) => {
  const body = safePath (['payload', 'body', 'data']) (message);

  let emailId;
  try {
    // 2. emailId
    const bodyText = Buffer.from (body, 'base64').toString('ascii');
    const emailIdRe = /<meta name="emailId".content="(\d+)" \/>/gi;
    const emailReResult = emailIdRe.exec(bodyText);
    emailId = captureOrNull (emailReResult);
  } catch (e) {
    return null;
  }

  return emailId || null;
}

const extractBounceDateTime = (message) => {
  const headers = safePath (['payload', 'headers']) (message);
  if (Array.isArray (headers)) {
    const bounceDate = headers
          .filter (({ name }) => name === 'Date')
          .map (({ value }) => value);

    if (bounceDate.length) {
      return dayjs (bounceDate[0]);
    }
  }
  return null;
};

// parse gmail message
const parseThreadMessages = (threadMessages) => {
  if (Array.isArray (threadMessages) && threadMessages.length > 1) {
    // messages are ordered by time
    const originalMessage = threadMessages [0];
    const bounceMessage = threadMessages [1];

    const recipient = extractToHeader (originalMessage);
    const emailId = extractEmailId (originalMessage);
    const bounceDateTime = extractBounceDateTime (bounceMessage);

    if (recipient && emailId  && bounceDateTime) {
      return { recipient, emailId, bounceDateTime };
    }
  }
  return null;
}

// use gmail api to get messages that match a query
// we need to query email twice: once to get message parts
// which will include the headers
// and once again to get the raw message, which will include the original
const queryGmail = async () => {
  const query = 'from:mailer-daemon@googlemail.com newer_than:1d';
  let bouncedMessageThreads;
  try {
    bouncedMessageThreads = await Future.promise (getServiceMailThreads ({ query }));
  } catch (e) {
    log.error ("error getting mail", { error: e });
    return [e];
  }

  // TODO get time from bounced reply as well
  const parsedOriginalMessage = bouncedMessageThreads
        .map ((thread) => safePath (['data', 'messages']) (thread))
        .map (parseThreadMessages);

  return [false, parsedOriginalMessage];
}


// update email recipients with failed delivery
const updateRecipentsWithFailedDelivery = async (updates) => {
  // log.info ('updating email recipient records with delivery failure', updates)
  const query = updates.map (({ emailId, recipient }) =>
    `UPDATE tblEmail_Recipients
     SET
       Success = 0
     WHERE Email_ID = ${emailId}
     AND Success = 1
     AND User_ID = (SELECT UserID from tblUsers WHERE Email = '${recipient}')`
  ).join(';')

  const options = {
    description: "update recipients with delivery failure",
    poolName: 'rainierReadWrite',
  };

  const [err, result] = await directQuery (query, options);

  if (err) {
    log.error ('failed to update recipient records', { err, updates});
    return [err];
  }
  log.debug ('intended recipient updates', updates);
  log.info (`recipient records updated`, result);
  return [false, result.rowsAffected];
};


// MONITOR

// 0. keep track of mail ids to check

const activeIds = new Set();
let queued = false;

const monitor = async (emailIds = []) => {
  log.info ('mail monitor called', { emailIds })

  emailIds.forEach ((id) => activeIds.add (id));

  // 1. get latest email records, plus active ids
  // (need Date_Time)
  const [err, sentEmailRecords] = await getEmailRecords (Array.from (activeIds));

  // console.log ('email records', result);

  if (err) {
    log.error ('error retrieving email records', { error: err });
    if (queued === false) {
      queued = true;
      setTimeout (monitor, 1000 * 60);
    }
    return;
  }

  // 2. remove old ids from activeIds, if any
  const tenMinutesAgo = dayjs ().subtract (10, 'm').toISOString();

  sentEmailRecords.forEach ((matchingRecord) => {
    const { Email_ID, Date_Time, Last_Attempt } = matchingRecord;
    const timeSent = dayjs (Date_Time);
    const lastAttempt = dayjs(Last_Attempt);
    if (timeSent.isBefore (tenMinutesAgo) && lastAttempt.isBefore(tenMinutesAgo)) {
      // if record is neither recent nor one of the ids provided to track, remove it
      if (!emailIds.includes (Email_ID)) {
        log.info ('removing email older than 10 minutes from active ids to check', {
          emailId: Email_ID,
          timeSent: timeSent.toISOString (),
          lastAttempt: lastAttempt.toISOString (),
          now: dayjs().toISOString (),
        });
        activeIds.delete (Email_ID);
      } else {
        // if the monitor runs again, it won't be called with the same list of ids
        // and if they are too old, they will be removed next call
      }
    } else {
      activeIds.add (Email_ID); // ensure results that are recent are actively monitored
    }
  });

  if (activeIds.size === 0) {
    log.info ('no active email ids to monitor');
    queued = false;
    return;
  }

  // 3. call gmail api with query for bounced mail

  const [gmailErr, parsedGmailMessages] = await queryGmail ();
  if (gmailErr) {
    // re-queue and exit
    if (queued === false) {
      queued = true;
      setTimeout (monitor, 1000 * 60);
    } else {
      // already another check in queue
    }
    return;
  }

  // 4. parse results, looking for matching email ids
  //    (email will have id embedded in meta tag of html body)

  const parsedMessages = parsedGmailMessages
        .filter ((record) => record && record.recipient)
        .map ((record) => ({
          ...record,
          // scraped id is a string, need it to be an int to compare to activeIds
          emailId: parseInt (record.emailId, 10),
          bounceDateTime: record.bounceDateTime.toISOString(),
        }))

  console.log ('Gmail Result')
  console.table (parsedMessages)

  console.log ('active ids', activeIds)

  // 5. if matching emails, update tblEmail_Recipients with succeeded flag = 0
  // (a) -- match emailid
  // (b) -- match time
  const matchingBouncedMails = parsedMessages
        .filter (({ emailId }) => activeIds.has (emailId))
        .map ((bouncedMail) => {
          const matchingEmailSentRecord = sentEmailRecords.find (({ Email_ID }) => {
            return Email_ID === bouncedMail.emailId;
          });
          if (matchingEmailSentRecord) {
            return Object.assign (bouncedMail, { lastAttempt: matchingEmailSentRecord.Last_Attempt });
          } else {
            return bouncedMail;
          }
        });

  console.log ('Matching Bounced Mail')
  console.table (matchingBouncedMails);

  // check time of bounced email against recipient record's last attempt

  const newlyBouncedMails = matchingBouncedMails
        .filter(({ lastAttempt, bounceDateTime }) => {
          if (dayjs (lastAttempt).isAfter (bounceDateTime)) {
            return false;
          } else {
            return true;
          }
        });

  console.log ('Newly Bounced')
  console.table (newlyBouncedMails)

  const [updateErr, updateResp] = await updateRecipentsWithFailedDelivery (newlyBouncedMails);

  if (updateErr) {
    // already logged
  } else {
    // already logged
  }

  // 6. if queued === FALSE
  //    set queued to TRUE
  //    call setTimeout for this function (recursively) with no args
  if (queued) {
    log.debug ('monitor already queued', null);
    return;
  } else {
    log.debug ('queueing monitor', null);
    queued = true;
    setTimeout (monitor, 1000 * 60);
  }
}

module.exports.monitor = monitor;
