const { dropbox } = require("../../utility/Dropbox");
const sql = require("mssql");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");
const { safePath } = require("../../utility/objectUtils");

const initializeLogger = require("../../log-service");

const log = initializeLogger(
  "data-submission/check-name"
);

const checkSubmissionName = async (req, res) => {
  const { id: userId } = (req.user || {});
  const { shortName, longName, submissionId: targetSubmissionId } = req.body;

  const pool = await userReadAndWritePool;

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

  // 1. check if short name is already published
  if (shortName) {
    try {
      const checkNameRequest = await new sql.Request(pool);
      const sqlResponse = await checkNameRequest.query(`
        select ID from tblDatasets
        where Dataset_Name = '${shortName}'
      `);
      // the short name is already published
      shortNameIsAlreadyInUse = Boolean(safePath(['recordset', '0', 'ID'])(sqlResponse));
    } catch (e) {
      log.error('sql error', { e });
      return res.sendStatus(500);
    }
  }

  // 2. check long name
  if (longName) {
    try {
      const checkLongNameRequest = await new sql.Request(pool);
      const longNameResponse = await checkLongNameRequest.query(`
        select ID, Submitter_ID from tblData_Submissions
        where Dataset_Long_Name = '${longName}'
      `);
      let existingSubmissionId = safePath(['recordset', '0', 'ID'])(longNameResponse);
      let existingSubmissionSubmitterId = safePath(['recordset', '0', 'Submitter_ID'])(longNameResponse);
      longNameIsAlreadyInUse = Boolean(existingSubmissionId);
      log.debug ('long name check', { existingSubmissionId, existingSubmissionSubmitterId, userId, targetSubmissionId });
      if (existingSubmissionId !== targetSubmissionId || existingSubmissionSubmitterId !== userId) {
        longNameUpdateConflict = true;
      }
    } catch (e) {
      log.error('sql error', { e });
      return res.sendStatus(500);
    }
  }

  // 3. check dropbox folder
  if (shortName) {
    try {
      await dropbox.filesListFolder({ path: `/${shortName}` });
    } catch (e) {
      if (e && e.status === 409) {
        log.info("folder not found", { responseStatus: e.status });
        folderExists = false;
      } else {
        log.error("error getting folder ls", { ...e, userId });
        return res.sendStatus(500);
      }
    }
  }

  //  4. ensure that if short name exists, it belongs to expected dataset
  if (shortName) {
    try {
      const checkShortNameRequest = await new sql.Request(pool);
      const resp = await checkShortNameRequest.query(`
        select ID, Submitter_ID from tblData_Submissions
        where Filename_Root = '${shortName}'
      `);
      const existingSubmissionId = safePath(['recordset', '0', 'ID'])(resp);
      const existingSubmissionSubmitterId = safePath(['recordset', '0', 'Submitter_ID'])(resp);
      log.debug ('short name check', { existingSubmissionId, existingSubmissionSubmitterId, userId, targetSubmissionId });

      if (existingSubmissionId !== targetSubmissionId || existingSubmissionSubmitterId !== userId) {
        shortNameUpdateConflict = true;
      }
    } catch (e) {
      log.error('sql error', { e });
      return res.sendStatus(500);
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
  }


  log.info ("result of checkName", { ...payload, userId });

  res.json (payload);
};

module.exports = checkSubmissionName;
