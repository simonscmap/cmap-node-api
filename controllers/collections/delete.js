const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/delete');

/**
 * Delete a collection by ID.
 * Enforces ownership - only the collection owner can delete.
 * Uses explicit transaction to:
 * 1. Verify ownership before any modifications
 * 2. Delete child rows from tblCollection_Datasets
 * 3. Delete parent row from tblCollections
 */
module.exports = async (req, res) => {
  const collectionId = parseInt(req.params.id, 10);

  // Validate ID
  if (!collectionId || collectionId < 1) {
    return res.status(400).end();
  }

  // Ensure user is authenticated
  if (!req.user || !req.user.id) {
    return res.status(401).end();
  }

  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (error) {
    log.error('Failed to get database pool', {
      error,
      collectionId,
      userId: req.user.id
    });
    return res.status(500).end();
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const request = new sql.Request(tx)
      .input('id', sql.Int, collectionId)
      .input('userId', sql.Int, req.user.id);

    // Step 1: Verify ownership first
    const ownershipCheck = await request.query(`
      SELECT 1 FROM dbo.tblCollections
      WHERE Collection_ID = @id AND User_ID = @userId;
    `);

    if (!ownershipCheck.recordset || ownershipCheck.recordset.length === 0) {
      await tx.rollback();
      return res.status(404).end();
    }

    // Step 2: Delete child rows
    await request.query(`
      DELETE FROM dbo.tblCollection_Datasets
      WHERE Collection_ID = @id;
    `);

    // Step 3: Delete parent collection
    await request.query(`
      DELETE FROM dbo.tblCollections
      WHERE Collection_ID = @id AND User_ID = @userId;
    `)

    await tx.commit();

    log.info('Collection deleted successfully', {
      collectionId,
      userId: req.user.id
    });

    return res.status(204).end();
  } catch (err) {
    try {
      await tx.rollback();
    } catch (rollbackErr) {
      // Rollback failed, already logged below
    }
    log.error('DELETE /collections/:id failed', {
      collectionId,
      userId: req.user.id,
      error: err && err.message
    });
    return res.status(500).end();
  }
};
