const { dropbox } = require("../../utility/Dropbox");
const sql = require("mssql");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");
const { safePath } = require("../../utility/objectUtils");

const initializeLogger = require("../../log-service");

const log = initializeLogger(
  "data-submission/check-name"
);

const getOriginalNames = async (targetSubmissionId) => {
  const pool = await userReadAndWritePool;
  let resp;
  try {
    const checkLongNameRequest = new sql.Request(pool);
    resp = await checkLongNameRequest.query(`
        select Filename_Root, Dataset_Long_Name
        from tblData_Submissions
        where ID = ${targetSubmissionId}
      `);
  } catch (e) {
    return [e]
  }
  const result = {
    originalShortName: safePath (['recordset', '0', 'Filename_Root']) (resp),
    originalLongName: safePath (['recordset', '0', 'Dataset_Long_Name']) (resp)
  };

  return [null, result];
}

const checkLongName = async (longName, userId, targetSubmissionId) => {
  const pool = await userReadAndWritePool;

  let longNameIsAlreadyInUse = false; // already in tblDatasets
  let longNameUpdateConflict = false;
  let error = false;

  try {
    const checkLongNameRequest = new sql.Request(pool);
    const longNameResponse = await checkLongNameRequest.query(`
      select ID from tblDatasets
      where Dataset_Long_Name = '${longName}'
    `);
    let id = safePath(['recordset', '0', 'ID'])(longNameResponse);
    if (id) {
      longNameIsAlreadyInUse = true;
    }

  } catch (e) {
    log.error('sql error', { e });
    error = e;
  }

  try {
    const checkLongNameRequest = new sql.Request(pool);
    const resp = await checkLongNameRequest.query(`
        select ID, Submitter_ID from tblData_Submissions
        where Dataset_Long_Name = '${longName}'
      `);
    if (resp && resp.recordset && resp.recordset.length === 0) {
      // no record with that long name found
      log.info('long name check: no conflicting record found');
    } else {
      let existingSubmissionId = safePath(['recordset', '0', 'ID'])(resp);
      let existingSubmissionSubmitterId = safePath(['recordset', '0', 'Submitter_ID'])(resp);

      if (!existingSubmissionId || !existingSubmissionSubmitterId) {
        log.warn('long name check: not in use but missing fields', {
          targetSubmissionId,
          resp: resp.recordset[0]
        });
      } else {
        if (Boolean(existingSubmissionId) && existingSubmissionId !== targetSubmissionId) {
          longNameUpdateConflict = true;
          log.info('long name check: in use by another submission', {
            existingSubmissionId,
            existingSubmissionSubmitterId,
            userId,
            targetSubmissionId
          });
        } else if (existingSubmissionSubmitterId !== userId) {
          longNameUpdateConflict = true;
          log.info('long name check: in use by submission not owned by user', {
            existingSubmissionId,
            userId,
            targetSubmissionId
          });
        }
      }
    }
  } catch (e) {
    log.error('sql error', { e });
    error = e;
  }

  return [error, { longNameUpdateConflict, longNameIsAlreadyInUse }];
}


const checkShortName = async (shortName, userId, targetSubmissionId) => {
  if (!shortName) {
    return ['No short name provided'];
  }

  const pool = await userReadAndWritePool;

  let shortNameIsAlreadyInUse,
      shortNameUpdateConflict,
      checkShortNameError,
      folderExists;

  // 1. check if short name exists in published datasets
  let queryPublishedResp;
  try {
    const checkNameRequest = new sql.Request(pool);
    queryPublishedResp = await checkNameRequest.query(`
        select ID from tblDatasets
        where Dataset_Name = '${shortName}'
    `);
    // the short name is already published
  } catch (e) {
    log.error('sql error', { e });
    checkShortNameError = 'System error checking short name';
  }

  shortNameIsAlreadyInUse = Boolean(safePath(['recordset', '0', 'ID'])(queryPublishedResp));


  // 2. check if short name exists in a submission in dropbox
  let lsResp;
  try {
    lsResp = await dropbox.filesListFolder({ path: `/${shortName}` });
    // if no error, a result was returned, indicating the folder exists
    folderExists = true;
  } catch (e) {
    if (e && e.status === 409) {
      log.info("folder not found", { responseStatus: e.status });
      folderExists = false;
    } else {
      log.error("error getting folder ls", { ...e, userId });
      log.error("dropbox response", lsResp)
      console.log (lsResp);
      checkShortNameError = 'Error checking short name against existing data submissions';
    }
  }

  //  3. if short name exists in dropbox, ensure that it belongs to expected dataset
  let conflictResp;
  try {
    const checkShortNameRequest = new sql.Request(pool);
    conflictResp = await checkShortNameRequest.query(`
        select ID, Submitter_ID from tblData_Submissions
        where Filename_Root = '${shortName}'
    `);
  } catch (e) {
    log.error('sql error', { e });
    checkShortNameError = 'System error checking short name ownership';
  }

  const respLen = safePath (['recordset', 'length']) (conflictResp);

  if (respLen === 0) {
    // no rec with that long name found
    log.debug ('short name check: no conflicting record found');
    shortNameUpdateConflict = false;
    if (shortNameIsAlreadyInUse) {
      log.error ('conflicting records: short name is not in submissions, but is published', {
        shortName,
        datasetId: safePath(['recordset', '0', 'ID'])(queryPublishedResp)
      });
    }
  } else {
    // there is an existing record in submissions with this short name
    const existingSubmissionId = safePath(['recordset', '0', 'ID'])(conflictResp);
    const existingSubmissionSubmitterId = safePath(['recordset', '0', 'Submitter_ID'])(conflictResp);

    const info = { userId, targetSubmissionId, shortName, existingSubmissionId, existingSubmissionSubmitterId };
    const tag = 'short name check';
    // does the submission belong to current user?

    // if no target submission, this is being checked as "new", and is therefore in conflict
    if (!targetSubmissionId) {
      shortNameUpdateConflict = true;
      log.debug(
        `${tag}: a record with this short name already exists, but no target submission was provided`,
        info);
    } else if (targetSubmissionId === existingSubmissionId) {
      // if there is a target submission, targetSubmissionId must equal the existingSubmissionId
      if (existingSubmissionSubmitterId !== userId) {
        shortNameUpdateConflict = true;
        log.debug(
          `${tag}: the existing record matches the target submission, but the user is not the owner`,
          info);
      } else {
        shortNameUpdateConflict = false;
        log.debug(
          `${tag}: the existing record matches the target submission, and the user is the owner`,
          info);
      }
    } else if (targetSubmissionId !== existingSubmissionId) {
      // if it it is not the same as the existing submission id, it is in conflict
      shortNameUpdateConflict = true;
      log.debug(
        `${tag}: a record with this short name already exists, but belongs to a submission different from the target submission`,
        info);
    }
  }

  return [checkShortNameError, { shortNameIsAlreadyInUse, shortNameUpdateConflict, folderExists }];
}


const checkSubmissionName = async (req, res) => {
  const { id: userId } = (req.user || {});
  const { shortName, longName, submissionId: targetSubmissionId } = req.body;

  // prepare the 3 flags we're determining
  let shortNameIsAlreadyInUse = false;
  let longNameIsAlreadyInUse = false;
  let folderExists = true;
  // additional info
  let errors = [];
  let shortNameUpdateConflict;
  let longNameUpdateConflict;


  if (!shortName) {
    errors.push('No short name provided');
  }
  if (!longName) {
    errors.push('No long name provided');
  }

  if (errors.length) {
    return res.status(400).send (errors.join ('; '));
  }

  // 2. check long name
  if (longName) {
    const [error, result] = await checkLongName (longName, userId, targetSubmissionId);
    if (error) {
      return res.status(500).send ('System error checking long name');
    } else {
      longNameUpdateConflict = result.longNameUpdateConflict;
      longNameIsAlreadyInUse = result.longNameIsAlreadyInUse;
    }
  }

  if (shortName) {
    // error should be a string
    const [error, result] = await checkShortName (shortName, userId, targetSubmissionId);
    if (error) {
      return res.status(500).send (error);
    } else {
      shortNameIsAlreadyInUse = result.shortNameIsAlreadyInUse;
      shortNameUpdateConflict = result.shortNameUpdateConflict;
      folderExists = result.folderExists;
    }
  }

  let originalNames = {};
  if (targetSubmissionId) {
    const [err, result] = await getOriginalNames (targetSubmissionId);
    if (err) {
      errors.push (err);
    } else {
      originalNames = result;
    }
  }

  // 5. send results

  const payload = {
    shortNameIsAlreadyInUse,
    shortNameUpdateConflict,
    folderExists,
    longNameIsAlreadyInUse,
    longNameUpdateConflict,
    errors,
    shortName,
    longName,
    ...originalNames,
  }


  log.info ("result of checkName", { ...payload, userId });

  res.json (payload);
};

module.exports = { checkLongName, checkShortName, checkSubmissionName };
