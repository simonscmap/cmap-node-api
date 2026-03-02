const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');
const retrieveCollectionResponse = require('./helpers/retrieveCollection');

const log = initializeLogger('controllers/collections/create');

/**
 * Create a new collection with optional datasets.
 * POST /collections
 *
 * Request body:
 * - collectionName (required): string, 1-200 chars
 * - description (optional): string, 0-500 chars
 * - private (optional): boolean, default true
 * - datasets (optional): array of dataset short names
 *
 * Transaction flow:
 * 1. Insert collection into tblCollections
 * 2. Validate requested datasets exist
 * 3. Insert valid datasets into tblCollection_Datasets
 * 4. Retrieve and return complete collection object with datasets
 *
 * Response: Full collection object matching detail endpoint format
 */
module.exports = async (req, res) => {
  // Ensure user is authenticated
  if (!req.user || !req.user.id) {
    return res.status(401).end();
  }

  const userId = req.user.id;
  const {
    collectionName,
    description,
    isPublic,
    datasets,
  } = req.validatedBody;

  log.info('Creating collection', {
    userId,
    collectionName,
    isPublic,
    requestedDatasetCount: datasets.length,
  });

  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (error) {
    log.error('Failed to get database pool', {
      error,
      userId,
      collectionName,
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

    // Generate UTC timestamp for creation
    const now = new Date().toISOString();

    // Step 1: Insert collection and get the new ID
    const insertRequest = new sql.Request(tx)
      .input('userId', sql.Int, userId)
      .input('name', sql.NVarChar(200), collectionName)
      .input('private', sql.Bit, !isPublic)
      .input('description', sql.NVarChar(500), description)
      .input('createdAt', sql.DateTime2, now)
      .input('modifiedAt', sql.DateTime2, now);

    const insertResult = await insertRequest.query(`
      INSERT INTO dbo.tblCollections (User_ID, Collection_Name, Private, Description, Downloads, Views, Copies, Created_At, Modified_At)
      VALUES (@userId, @name, @private, @description, 0, 0, 0, @createdAt, @modifiedAt);
      SELECT SCOPE_IDENTITY() AS Collection_ID;
    `);

    if (!insertResult.recordset || insertResult.recordset.length === 0) {
      await tx.rollback();
      log.error('Failed to get collection ID after insert', {
        userId,
        collectionName,
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
      collectionName,
    });

    // Step 2: If datasets are provided, validate and insert them
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
      const invalidDatasetCount = datasets.length - validDatasets.length;

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
        table.columns.add('Collection_ID', sql.Int, { nullable: false });
        table.columns.add('Dataset_Short_Name', sql.NVarChar(100), { nullable: false });

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
    });

    // Step 4: Retrieve complete collection object with datasets
    try {
      const collectionData = await retrieveCollectionResponse(pool, newCollectionId, userId);
      return res.status(201).json(collectionData);
    } catch (retrievalErr) {
      log.error('Failed to retrieve collection after successful creation', {
        userId,
        collectionId: newCollectionId,
        error: retrievalErr && retrievalErr.message,
      });
      // Collection was created successfully, but we can't return full data
      return res.status(201).json({
        collectionId: newCollectionId,
        message: 'Collection created successfully but full details unavailable'
      });
    }
  } catch (err) {
    try {
      await tx.rollback();
    } catch (rollbackErr) {
      log.error('Transaction rollback failed', {
        userId,
        collectionName,
        rollbackError: rollbackErr && rollbackErr.message,
      });
    }

    log.error('POST /collections failed', {
      userId,
      collectionName,
      error: err && err.message,
      stack: err && err.stack,
    });

    return res.status(500).json({
      error: 'database_error',
      message: 'Failed to create collection',
    });
  }
};
