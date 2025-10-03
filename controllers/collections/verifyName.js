const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/verifyName');

const query = `
  SELECT COUNT(*) as count
  FROM tblCollections
  WHERE Collection_Name = @name AND User_ID = @userId
`;

module.exports = async (req, res) => {
  const { name } = req.validatedQuery;
  const userId = req.user.id;

  log.info('checking collection name availability', { name, userId });

  try {
    const pool = await pools.userReadAndWritePool;
    const request = new sql.Request(pool);

    request.input('name', sql.NVarChar, name);
    request.input('userId', sql.Int, userId);

    const result = await request.query(query);
    const count = result.recordset[0].count;
    const isAvailable = count === 0;

    log.info('collection name availability check complete', {
      name,
      userId,
      isAvailable,
      existingCount: count
    });

    res.status(200).json({
      name,
      isAvailable
    });
  } catch (error) {
    log.error('error checking collection name availability', {
      error: error.message,
      name,
      userId
    });
    res.status(500).json({
      error: 'server_error',
      message: 'Error checking collection name availability'
    });
  }
};
