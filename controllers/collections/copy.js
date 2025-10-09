const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/copy');

/**
 * Copy a collection to the authenticated user's private collections.
 * POST /collections/:id/copy
 *
 * Requirements:
 * - User must be authenticated
 * - Can copy public collections or user's own collections
 * - New collection is always private
 * - Copies collection metadata and associated datasets
 * - Auto-generates unique name with "copy" suffix
 *
 * Transaction flow:
 * 1. Fetch source collection (check access)
 * 2. Fetch source datasets
 * 3. Generate unique name within transaction
 * 4. Insert new collection
 * 5. Copy datasets to new collection
 *
 * Response:
 * {
 *   collectionId: number,
 *   name: string
 * }
 */
module.exports = async (req, res) => {
  const userId = req.user.id;
  const sourceId = req.validatedParams.id;

  log.info('Copying collection', {
    userId,
    sourceCollectionId: sourceId,
  });

  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (error) {
    log.error('Failed to get database pool', {
      error,
      userId,
      sourceCollectionId: sourceId,
    });
    return res.status(500).json({
      error: 'database_error',
      message: 'Failed to connect to database',
    });
  }

  // Step 1: Fetch source collection and verify access (BEFORE transaction)
  try {
    const sourceRequest = new sql.Request(pool)
      .input('sourceId', sql.Int, sourceId)
      .input('userId', sql.Int, userId);

    const sourceResult = await sourceRequest.query(`
      SELECT Collection_Name, Description, Private, User_ID
      FROM dbo.tblCollections
      WHERE Collection_ID = @sourceId
        AND (Private = 0 OR User_ID = @userId)
    `);

    if (!sourceResult.recordset || sourceResult.recordset.length === 0) {
      log.warn('Collection not found or not accessible', {
        userId,
        sourceCollectionId: sourceId,
      });
      return res.status(404).json({
        error: 'not_found',
        message: 'Collection not found or not accessible',
      });
    }

    const sourceCollection = sourceResult.recordset[0];
    const sourceName = sourceCollection.Collection_Name;
    const sourceDescription = sourceCollection.Description;

    log.info('Source collection found', {
      userId,
      sourceCollectionId: sourceId,
      sourceName,
    });

    // Step 2: Fetch source datasets (BEFORE transaction)
    const datasetsRequest = new sql.Request(pool).input(
      'sourceId',
      sql.Int,
      sourceId,
    );

    const datasetsResult = await datasetsRequest.query(`
      SELECT Dataset_Short_Name
      FROM dbo.tblCollection_Datasets
      WHERE Collection_ID = @sourceId
    `);

    const sourceDatasets = datasetsResult.recordset.map(
      (row) => row.Dataset_Short_Name,
    );

    log.info('Source datasets retrieved', {
      userId,
      sourceCollectionId: sourceId,
      datasetCount: sourceDatasets.length,
    });

    // Step 3: Generate unique name (BEFORE transaction)
    let uniqueName = sourceName + ' copy';
    let copyNumber = 2;
    let nameExists = true;

    while (nameExists) {
      const checkRequest = new sql.Request(pool)
        .input('candidateName', sql.NVarChar(200), uniqueName)
        .input('userId', sql.Int, userId);

      const checkResult = await checkRequest.query(`
        SELECT COUNT(*) as count
        FROM dbo.tblCollections
        WHERE Collection_Name = @candidateName AND User_ID = @userId
      `);

      const count = checkResult.recordset[0].count;

      if (count === 0) {
        nameExists = false;
      } else {
        uniqueName = sourceName + ' copy ' + copyNumber;
        copyNumber++;
      }
    }

    log.info('Unique name generated', {
      userId,
      sourceCollectionId: sourceId,
      uniqueName,
    });

    // Now begin transaction with all data prepared
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // Generate UTC timestamp for creation
      const now = new Date().toISOString();

      // Step 4: Insert new collection
      const insertRequest = new sql.Request(tx)
        .input('userId', sql.Int, userId)
        .input('name', sql.NVarChar(200), uniqueName)
        .input('description', sql.NVarChar(500), sourceDescription)
        .input('createdAt', sql.DateTime2, now)
        .input('modifiedAt', sql.DateTime2, now);

      const insertResult = await insertRequest.query(`
        INSERT INTO dbo.tblCollections (User_ID, Collection_Name, Private, Description, Downloads, Views, Copies, Created_At, Modified_At)
        VALUES (@userId, @name, 1, @description, 0, 0, 0, @createdAt, @modifiedAt);
        SELECT SCOPE_IDENTITY() AS Collection_ID;
      `);

      if (!insertResult.recordset || insertResult.recordset.length === 0) {
        await tx.rollback();
        log.error('Failed to get collection ID after insert', {
          userId,
          sourceCollectionId: sourceId,
          uniqueName,
        });
        return res.status(500).json({
          error: 'database_error',
          message: 'Failed to copy collection',
        });
      }

      const newCollectionId = parseInt(insertResult.recordset[0].Collection_ID, 10);

      log.info('New collection created', {
        userId,
        sourceCollectionId: sourceId,
        newCollectionId,
        uniqueName,
      });

      // Step 5: Copy datasets if source had any
      if (sourceDatasets.length > 0) {
        const datasetInsertRequest = new sql.Request(tx)
          .input('collectionId', sql.Int, newCollectionId);

        sourceDatasets.forEach((datasetName, idx) => {
          datasetInsertRequest.input(`dataset${idx}`, sql.NVarChar(100), datasetName);
        });

        const valuesClauses = sourceDatasets
          .map((_, idx) => `(@collectionId, @dataset${idx})`)
          .join(', ');

        await datasetInsertRequest.query(`
          INSERT INTO dbo.tblCollection_Datasets (Collection_ID, Dataset_Short_Name)
          VALUES ${valuesClauses}
        `);

        log.info('Datasets copied to new collection', {
          userId,
          sourceCollectionId: sourceId,
          newCollectionId,
          datasetCount: sourceDatasets.length,
        });
      }

      // Step 6: Increment copies count on source collection
      const updateRequest = new sql.Request(tx)
        .input('sourceId', sql.Int, sourceId);

      await updateRequest.query(`
        UPDATE dbo.tblCollections
        SET Copies = ISNULL(Copies, 0) + 1
        WHERE Collection_ID = @sourceId
      `);

      log.info('Source collection copies count incremented', {
        userId,
        sourceCollectionId: sourceId,
        newCollectionId,
      });

      // Commit transaction
      await tx.commit();

      log.info('Collection copy completed', {
        userId,
        sourceCollectionId: sourceId,
        newCollectionId,
        uniqueName,
      });

      // Return response
      return res.status(201).json({
        collectionId: newCollectionId,
        name: uniqueName,
      });
    } catch (txErr) {
      try {
        await tx.rollback();
      } catch (rollbackErr) {
        log.error('Transaction rollback failed', {
          userId,
          sourceCollectionId: sourceId,
          rollbackError: rollbackErr && rollbackErr.message,
        });
      }

      log.error('Transaction failed during collection copy', {
        userId,
        sourceCollectionId: sourceId,
        error: txErr && txErr.message,
        stack: txErr && txErr.stack,
      });

      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to copy collection',
      });
    }
  } catch (err) {
    log.error('POST /collections/:id/copy failed', {
      userId,
      sourceCollectionId: sourceId,
      error: err && err.message,
      stack: err && err.stack,
    });

    return res.status(500).json({
      error: 'database_error',
      message: 'Failed to copy collection',
    });
  }
};
