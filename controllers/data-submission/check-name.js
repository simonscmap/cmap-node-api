const { dropbox } = require("../../utility/Dropbox");
const sql = require("mssql");
const { userReadAndWritePool } = require("../../dbHandlers/dbPools");
const { safePath } = require("../../utility/objectUtils");

const initializeLogger = require("../../log-service");

const log = initializeLogger(
  "data-submission/check-name"
);

const checkSubmissionName = async (req, res) => {
  const { id } = (req.user || {});
  const { shortName, longName } = req.body;

  const pool = await userReadAndWritePool;

  // prepare the 3 flags we're determining
  let shortNameIsAlreadyInUse = false;
  let longNameIsAlreadyInUse = false;
  let folderExists = true;
  let errors = [];

  // 1. check short name
  if (shortName) {
    try {
      const checkNameRequest = await new sql.Request(pool);
      const sqlResponse = await checkNameRequest.query(`
      select ID from tblDatasets
      where Dataset_Name = '${shortName}'
    `);
      shortNameIsAlreadyInUse = Boolean(safePath(['recordset', '0', 'ID'])(sqlResponse));
    } catch (e) {
      log.error('sql error', { e });
      return res.sendStatus(500);
    }
  } else {
    shortNameIsAlreadyInUse = true;
    errors.push ('No short name provided');
  }

  // 2. check long name
  if (longName) {
    try {
      const checkLongNameRequest = await new sql.Request(pool);
      const longNameResponse = await checkLongNameRequest.query(`
      select ID from tblData_Submissions
      where Dataset_Long_Name = '${longName}'
    `);
      longNameIsAlreadyInUse = Boolean(safePath(['recordset', '0', 'ID'])(longNameResponse));
    } catch (e) {
      log.error('sql error', { e });
      return res.sendStatus(500);
    }
  } else {
    longNameIsAlreadyInUse = true; // mark conflict
    errors.push ('No long name provided');
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
        log.error("error getting folder ls", { ...e, userId: id });
        return res.sendStatus(500);
      }
    }
  }

  // 4. send results

  log.info ("result of checkName", { errors, folderExists, shortNameIsAlreadyInUse, longNameIsAlreadyInUse, shortName, longName, userId: id });

  const payload = {
    shortNameIsAlreadyInUse,
    folderExists,
    longNameIsAlreadyInUse,
    errors,
    shortName,
    longName,
  }

  if (folderExists || shortNameIsAlreadyInUse || longNameIsAlreadyInUse || errors.length) {
    res.json ({ conflict: true, ...payload });
  } else {
    res.json ({ conflict: false, ...payload });
  }

};

module.exports = checkSubmissionName;
