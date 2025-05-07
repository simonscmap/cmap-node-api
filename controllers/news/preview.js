const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

/*
   This controller provides means to change the view status of a news item to 'preview'.

   Preview changes its view_status to 'publish'

   NOTE the view_status field is an INT, and is treated as an enum
   by convention

   0 hidden
   1 draft
   2 preview
   3 publish
 */

const log = initializeLogger('controllers/news/preview');

let query = `UPDATE [Opedia].[dbo].[tblNews]
      SET view_status = 2
      WHERE ID = @ID`;

const requiredKeys = ['id'];

module.exports = async (req, res) => {
  log.trace('request to preview news item', { id: req.body.id });

  let missingKeys = requiredKeys.filter((key) => {
    if (!req.body[key]) {
      return true;
    }
    return false;
  });

  if (missingKeys.length > 0) {
    log.info('missing fields', missingKeys);
    res
      .status(400)
      .send(`Bad request: missing fields ${missingKeys.join(',')}`);
    return;
  }

  let { id } = req.body;
  let modifyDate = new Date().toISOString();

  log.trace('publish news item');

  let pool = await pools.userReadAndWritePool;
  let request = new sql.Request(pool);

  // input
  request.input('ID', sql.Int, id);
  request.input('modiyfy_date', sql.DateTime, modifyDate);

  let result;

  try {
    result = await request.query(query);
  } catch (e) {
    log.error('error previewing news item', { error: e });
    res.status(500).send('Error publishing news item');
    return;
  }

  if (result) {
    log.info('success previewing news item', { result });
    res.status(200).send(result.recordset);
    return;
  }

  log.error('unknown error previewing news item');
  res.sendStatus(500);
  return;
};
