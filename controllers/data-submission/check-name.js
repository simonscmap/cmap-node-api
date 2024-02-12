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
  const { name } = req.query;

  const pool = await userReadAndWritePool;
  const request = await new sql.Request(pool);

  let sqlResponse;
  let tableExists;
  try {
    const checkNameRequest = new sql.Request(pool);
    sqlResponse = await checkNameRequest.query (`
      select ID from tblDatasets
      where Dataset_Name = '${name}'
    `);
  } catch (e) {
    log.error ('sql error', { e });
    return res.sendStatus (500);
  }

  const existingId = safePath (['recordset', '0', 'ID']) (sqlResponse);
  if (existingId) {
    log.info ("short name already exists in tblDatasets", {
      name,
      existingDatasetId: existingId,
    });
    tableExists = true;
  }


  log.debug ('checking submission name', { name });

  let folderExists = true;
  let resultOfFolderLs;
  try {
    await dropbox.filesListFolder({ path: `/${name}` });
  } catch (e) {
    if (e && e.status === 409) {
      log.info ("folder not found", { responseStatus: e.status });
      folderExists = false;
    } else {
      log.error("error getting folder ls", { ...e, userId: id });
      return res.sendStatus(500);
    }
  }


  log.info ("result of checkName", { folderExists, tableExists, name, userId: id });

  if (tableExists || folderExists) {
    res.json ({ nameIsNotTaken: false, tableExists, folderExists });
  } else {
    res.json ({ nameIsNotTaken: true, name });
  }

};

module.exports = checkSubmissionName;
