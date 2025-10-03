const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/create');

/**
 * Create a new collection with optional datasets.
 * POST /collections
 *
 * Request body:
 * - collection_name (required): string, 1-200 chars
 * - description (optional): string, 0-500 chars
 * - private (optional): boolean, default true
 * - datasets (optional): array of dataset short names
 *
 * Transaction flow:
 * 1. Insert collection into tblCollections
 * 2. Validate requested datasets exist
 * 3. Insert valid datasets into tblCollection_Datasets
 *
 * Response:
 * {
 *   collection_id: number,
 *   invalid_dataset_count: number
 * }
 */
module.exports = async (req, res) => {
  // Ensure user is authenticated
  if (!req.user || !req.user.id) {
    return res.status(401).end();
  }

  const userId = req.user.id;
  const {
    collection_name,
    description = null,
    private: isPrivate = true,
    datasets = [],
  } = req.body;

  log.info('Creating collection', {
    userId,
    collectionName: collection_name,
    isPrivate,
    requestedDatasetCount: datasets.length,
  });

  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (error) {
    log.error('Failed to get database pool', {
      error,
      userId,
      collectionName: collection_name,
    });
    return res.status(500).json({
      error: 'database_error',
      message: 'Failed to connect to database',
    });
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    let newCollectionId;

    // Step 1: Insert collection and get the new ID
    const insertRequest = new sql.Request(tx)
      .input('userId', sql.Int, userId)
      .input('name', sql.NVarChar(200), collection_name)
      .input('private', sql.Bit, isPrivate)
      .input('description', sql.NVarChar(500), description);

    const insertResult = await insertRequest.query(`
      INSERT INTO dbo.tblCollections (User_ID, Collection_Name, Private, Description, Downloads, Views, Created_At, Modified_At)
      VALUES (@userId, @name, @private, @description, 0, 0, GETDATE(), GETDATE());
      SELECT SCOPE_IDENTITY() AS Collection_ID;
    `);

    if (!insertResult.recordset || insertResult.recordset.length === 0) {
      await tx.rollback();
      log.error('Failed to get collection ID after insert', {
        userId,
        collectionName: collection_name,
      });
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to create collection',
      });
    }

    newCollectionId = insertResult.recordset[0].Collection_ID;

    log.info('Collection created', {
      userId,
      collectionId: newCollectionId,
      collectionName: collection_name,
    });

    // Step 2: If datasets are provided, validate and insert them
    let invalidDatasetCount = 0;

    if (datasets.length > 0) {
      // Validate which datasets exist
      const validationRequest = new sql.Request(tx);

      // Build parameterized query for dataset validation
      const datasetParams = datasets
        .map((ds, idx) => {
          validationRequest.input(`dataset${idx}`, sql.NVarChar(100), ds);
          return `@dataset${idx}`;
        })
        .join(',');

      const validationResult = await validationRequest.query(`
        SELECT Dataset_Name
        FROM dbo.tblDatasets
        WHERE Dataset_Name IN (${datasetParams});
      `);

      const validDatasets = validationResult.recordset.map(
        (row) => row.Dataset_Name,
      );
      invalidDatasetCount = datasets.length - validDatasets.length;

      if (invalidDatasetCount > 0) {
        const invalidDatasets = datasets.filter(
          (ds) => !validDatasets.includes(ds),
        );
        log.warn('Some requested datasets do not exist', {
          userId,
          collectionId: newCollectionId,
          invalidDatasets,
          invalidCount: invalidDatasetCount,
        });
      }

      // Step 3: Insert valid datasets into junction table
      if (validDatasets.length > 0) {
        const table = new sql.Table('dbo.tblCollection_Datasets');
        table.columns.add('Collection_ID', sql.Int);
        table.columns.add('Dataset_Short_Name', sql.NVarChar(100));

        validDatasets.forEach((datasetName) => {
          table.rows.add(newCollectionId, datasetName);
        });

        const bulkRequest = new sql.Request(tx);
        await bulkRequest.bulk(table);

        log.info('Datasets added to collection', {
          userId,
          collectionId: newCollectionId,
          validDatasetCount: validDatasets.length,
        });
      }
    }

    // Commit transaction
    await tx.commit();

    log.info('Collection creation completed', {
      userId,
      collectionId: newCollectionId,
      invalidDatasetCount,
    });

    // Return simplified response
    return res.status(201).json({
      collection_id: newCollectionId,
      invalid_dataset_count: invalidDatasetCount,
    });
  } catch (err) {
    try {
      await tx.rollback();
    } catch (rollbackErr) {
      log.error('Transaction rollback failed', {
        userId,
        collectionName: collection_name,
        rollbackError: rollbackErr && rollbackErr.message,
      });
    }

    log.error('POST /collections failed', {
      userId,
      collectionName: collection_name,
      error: err && err.message,
      stack: err && err.stack,
    });

    return res.status(500).json({
      error: 'database_error',
      message: 'Failed to create collection',
    });
  }
};
