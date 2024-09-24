const Future = require("fluture");
const directQuery = require("../utility/directQuery");
const initializeLogger = require("../log-service");
const { getServiceMail } = require("../utility/email/getMail");
const { safePathOr, safePath } = require("../utility/objectUtils");

const log = initializeLogger ('mail-service/checkBouncedMail');

const messagesOrEmptyArray = safePathOr ([]) (Array.isArray) (['data', 'messages']);

// capture group will be index 1 of result
const captureOrNull = safePathOr (null) ((match) => typeof match === 'string') ([1]);

// fetch sent email records that match selected email ids
const getEmailRecords = async (emailIds) => {
  const query = `SELECT Email_ID, Date_Time, Subject
                 FROM tblEmail_Sent
                 WHERE Email_ID IN (${emailIds.join (', ')});`

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


// use gmail api to get messages that match a query
const queryGmail = async () => {
  const query = 'from:mailer-daemon@googlemail.com';
  let gmailResponses;
  try {
    gmailResponses = await Future.promise (getServiceMail ({ query }));
  } catch (e) {
    log.error ("error getting mail", { error: e });
    return [e];
  }

  const messages = gmailResponses
        .filter ((resp) => resp.success)
  const failedFetches = gmailResponses.filter ((resp) => !resp.success);

  if (failedFetches.length) {
    log.warn ("failed to retrieve some messages", failedFetches);
  }

  return [false, messages];
}


// parse gmail message
// get intended recipient and an emailId
const parseMessage = (message) => {
  const { data } = message;

  try {
    const { snippet, payload } = data;
    const { headers, parts } = payload;



    console.log (payload, { headers, parts});

    headers.forEach (x => console.log ('header', x))
    parts.forEach (x => console.log ('part', x));

    return [true];
    const fullText = Buffer.from(raw, 'base64').toString('ascii');

    const emailIdRe = /<meta name="emailId".content="(\d+)" \/>/gi;
    const emailReResult = emailIdRe.exec(fullText);
    const emailId = captureOrNull (emailReResult);

    const recipientRe = /\nX-Failed-Recipients:\s(.+)\n/gi;
    const recipientReResult = recipientRe.exec (fullText);
    const recipient = captureOrNull (recipientReResult);
    if (emailId && recipient) {
      return [
        false,
        {
          emailId: parseInt (emailId, 10),
          recipient
        }];
    } else {
      console.log ('parse result', {
        emailId,
        recipient,
        emailReResult,
        recipientReResult,
        snippet,
      });
      console.log (fullText)
      return [true];
    }
  } catch (e) {
    log.error ('error parsing message', e)
    return [true];
  }

}


// update email recipients with failed delivery
const updateRecipentsWithFailedDelivery = async (updates) => {
  log.info ('updating email recipient records with delivery failure', updates)
  const query = updates.map (({ emailId, recipient }) =>
    `UPDATE tblEmail_Recipients
     SET (Success = 0)
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
  log.info (`${'' + result.rowsAffected} recipient records updated`, { result, updates })
  return [false, result.rowsAffected];
};

// 0. keep track of mail ids to check

const activeIds = new Set();

let queued = false;

const monitor = async (emailIds = []) => {
  log.info ('mail monitor called', { emailIds })
  emailIds.forEach ((id) => activeIds.add (id));

  // 1. get email records (need time sent)
  const [err, result] = await getEmailRecords (Array.from (activeIds));

  console.log ('email records', result);

  if (err) {
    log.error ('error retrieving email records', { error: err });
    if (queued === false) {
      queued = true;
      setTimeout (monitor, 1000 * 60);
    }
    return;
  }

  // 2. remove old ids from activeIds, if any
  const now = new Date();
  result.forEach ((matchingRecord) => {
    const { Email_ID, Date_Time } = matchingRecord;
    const timeSent = new Date (Date_Time);
    if (now - timeSent > 100000) {
      log.info ('removing email id from active ids to check', { emailId: Email_ID });
      activeIds.delete (Email_ID);
    }
  });

  if (activeIds.size === 0) {
    log.info ('no active email ids to monitor')
    queued = false;
    return;
  }

  // 3. call gmail api with query for bounced mail

  const [gmailErr, gmailMessages] = await queryGmail ();
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

  const parsedResults = gmailMessages
        .map (parseMessage)
        .filter (([e, r]) => !e)
        .map (([, r]) => r);

  const errCount = gmailMessages.length - parsedResults.length;
  console.log ('errCount', errCount);

  // 5. if matching emails, update tblEmail_Recipients with succeeded flag = 0
  const matchingBouncedMails = parsedResults
        .filter (({ emailId }) => activeIds.has (emailId ));


  const [updateErr, updateResp] = await updateRecipentsWithFailedDelivery (matchingBouncedMails);

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
