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

  // 1. check short name

  let shortNameIsAlreadyInUse = false;
  try {
    const checkNameRequest = await new sql.Request(pool);
    const sqlResponse = await checkNameRequest.query (`
      select ID from tblDatasets
      where Dataset_Name = '${shortName}'
    `);
    shortNameIsAlreadyInUse = Boolean(safePath (['recordset', '0', 'ID']) (sqlResponse));
  } catch (e) {
    log.error ('sql error', { e });
    return res.sendStatus (500);
  }

  // 2. check long name
  let longNameIsAlreadyInUse = false;
  try {
    const checkLongNameRequest = await new sql.Request(pool);
    const longNameResponse = await checkLongNameRequest.query (`
      select ID from tblDatasets
      where Dataset_Long_Name = '${longName}'
    `);
    longNameIsAlreadyInUse = Boolean (safePath (['recordset', '0', 'ID']) (longNameResponse));
  } catch (e) {
    log.error ('sql error', { e });
    return res.sendStatus (500);
  }

  // 3. check dropbox folder

  let folderExists = true;
  try {
    await dropbox.filesListFolder({ path: `/${shortName}` });
  } catch (e) {
    if (e && e.status === 409) {
      log.info ("folder not found", { responseStatus: e.status });
      folderExists = false;
    } else {
      log.error("error getting folder ls", { ...e, userId: id });
      return res.sendStatus(500);
    }
  }

  // 4. send results

  log.info ("result of checkName", { folderExists, shortNameIsAlreadyInUse, longNameIsAlreadyInUse, shortName, longName, userId: id });

  if (folderExists || shortNameIsAlreadyInUse || longNameIsAlreadyInUse) {
    res.json ({ conflict: true, shortNameIsAlreadyInUse, folderExists, longNameIsAlreadyInUse });
  } else {
    res.json ({ conflict: false, shortName, longName });
  }

};

module.exports = checkSubmissionName;
