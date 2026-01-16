const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');
const retrieveCollectionResponse = require('./helpers/retrieveCollection');

const log = initializeLogger('controllers/collections/update');

/**
 * Update an existing collection.
 * PATCH /collections/:id
 *
 * Request body:
 * - collectionName (required): string, 5-200 chars
 * - description (required): string, 0-500 chars
 * - private (required): boolean
 * - datasets (required): array of dataset short names (can be empty)
 *
 * Transaction flow:
 * 1. Verify collection exists and user is owner
 * 2. Check name uniqueness if name changed
 * 3. Fetch current state to determine changes
 * 4. Update collection metadata if changed
 * 5. Remove datasets no longer in collection
 * 6. Add new datasets to collection
 * 7. Update Modified_At timestamp
 * 8. Retrieve and return complete collection object with datasets
 *
 * Response: Full collection object matching detail endpoint format
 */
module.exports = async (req, res) => {
  // Authentication already verified by passport middleware
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required'
    });
  }

  const userId = req.user.id;
  const collectionId = req.validatedParams.id;
  const { collectionName, description, isPublic, datasets } = req.validatedBody;

  log.info('updating collection', {
    userId,
    collectionId,
    collectionName,
    isPublic,
    datasetCount: datasets.length
  });

  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (error) {
    log.error('failed to get database pool', {
      error: error.message,
      userId,
      collectionId
    });
    return res.status(500).json({
      error: 'database_error',
      message: 'Failed to connect to database'
    });
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    // Step 1: Verify collection exists and user is owner
    const ownerCheckRequest = new sql.Request(tx);
    ownerCheckRequest.input('collectionId', sql.Int, collectionId);

    const ownerCheckResult = await ownerCheckRequest.query(`
      SELECT User_ID, Collection_Name, Description, Private
      FROM dbo.tblCollections
      WHERE Collection_ID = @collectionId
    `);

    if (!ownerCheckResult.recordset || ownerCheckResult.recordset.length === 0) {
      await tx.rollback();
      log.warn('collection not found', {
        userId,
        collectionId
      });
      return res.status(404).json({
        error: 'not_found',
        message: 'Collection not found'
      });
    }

    const currentCollection = ownerCheckResult.recordset[0];

    if (currentCollection.User_ID !== userId) {
      await tx.rollback();
      log.warn('user is not collection owner', {
        userId,
        collectionId,
        ownerId: currentCollection.User_ID
      });
      return res.status(403).json({
        error: 'forbidden',
        message: 'Only the owner can modify this collection'
      });
    }

    // Step 2: Check name uniqueness if name changed
    const nameChanged = currentCollection.Collection_Name !== collectionName;

    if (nameChanged) {
      const nameCheckRequest = new sql.Request(tx);
      nameCheckRequest.input('userId', sql.Int, userId);
      nameCheckRequest.input('name', sql.NVarChar(200), collectionName);
      nameCheckRequest.input('collectionId', sql.Int, collectionId);

      const nameCheckResult = await nameCheckRequest.query(`
        SELECT Collection_ID
        FROM dbo.tblCollections
        WHERE User_ID = @userId
          AND Collection_Name = @name
          AND Collection_ID != @collectionId
      `);

      if (nameCheckResult.recordset && nameCheckResult.recordset.length > 0) {
        await tx.rollback();
        log.warn('collection name already exists', {
          userId,
          collectionId,
          collectionName
        });
        return res.status(409).json({
          error: 'conflict',
          message: 'You already have a collection with this name'
        });
      }
    }

    // Step 3: Fetch current datasets
    const currentDatasetsRequest = new sql.Request(tx);
    currentDatasetsRequest.input('collectionId', sql.Int, collectionId);

    const currentDatasetsResult = await currentDatasetsRequest.query(`
      SELECT Dataset_Short_Name
      FROM dbo.tblCollection_Datasets
      WHERE Collection_ID = @collectionId
    `);

    const currentDatasets = currentDatasetsResult.recordset.map(row => row.Dataset_Short_Name);

    // Deduplicate requested datasets
    const uniqueDatasets = [...new Set(datasets)];

    // Calculate dataset differences
    const datasetsToAdd = uniqueDatasets.filter(ds => !currentDatasets.includes(ds));
    const datasetsToRemove = currentDatasets.filter(ds => !uniqueDatasets.includes(ds));

    // Determine if metadata changed
    const metadataChanged = nameChanged ||
      currentCollection.Description !== description ||
      Boolean(currentCollection.Private) !== !isPublic;

    const anyChanges = metadataChanged || datasetsToAdd.length > 0 || datasetsToRemove.length > 0;

    log.info('determined collection changes', {
      userId,
      collectionId,
      metadataChanged,
      nameChanged,
      datasetsToAdd: datasetsToAdd.length,
      datasetsToRemove: datasetsToRemove.length,
      anyChanges
    });

    // Step 4: Update collection metadata if changed
    if (metadataChanged || anyChanges) {
      const now = new Date().toISOString();
      const updateRequest = new sql.Request(tx);
      updateRequest.input('collectionId', sql.Int, collectionId);
      updateRequest.input('name', sql.NVarChar(200), collectionName);
      updateRequest.input('description', sql.NVarChar(500), description);
      updateRequest.input('private', sql.Bit, !isPublic);
      updateRequest.input('modifiedAt', sql.DateTime2, now);

      await updateRequest.query(`
        UPDATE dbo.tblCollections
        SET Collection_Name = @name,
            Description = @description,
            Private = @private,
            Modified_At = @modifiedAt
        WHERE Collection_ID = @collectionId
      `);

      log.info('updated collection metadata', {
        userId,
        collectionId
      });
    }

    // Step 5: Remove datasets no longer in collection
    if (datasetsToRemove.length > 0) {
      const removeRequest = new sql.Request(tx);
      removeRequest.input('collectionId', sql.Int, collectionId);

      const datasetParams = datasetsToRemove.map((ds, idx) => {
        removeRequest.input(`dataset${idx}`, sql.NVarChar(100), ds);
        return `@dataset${idx}`;
      }).join(',');

      await removeRequest.query(`
        DELETE FROM dbo.tblCollection_Datasets
        WHERE Collection_ID = @collectionId
          AND Dataset_Short_Name IN (${datasetParams})
      `);

      log.info('removed datasets from collection', {
        userId,
        collectionId,
        removedCount: datasetsToRemove.length
      });
    }

    // Step 6: Add new datasets to collection
    if (datasetsToAdd.length > 0) {
      const table = new sql.Table('dbo.tblCollection_Datasets');
      table.columns.add('Collection_ID', sql.Int, { nullable: false });
      table.columns.add('Dataset_Short_Name', sql.NVarChar(100), { nullable: false });

      datasetsToAdd.forEach(datasetName => {
        table.rows.add(collectionId, datasetName);
      });

      const bulkRequest = new sql.Request(tx);
      await bulkRequest.bulk(table);

      log.info('added datasets to collection', {
        userId,
        collectionId,
        addedCount: datasetsToAdd.length
      });
    }

    // Commit transaction
    await tx.commit();

    log.info('collection update completed', {
      userId,
      collectionId
    });

    // Step 8: Retrieve complete collection object with datasets
    try {
      const collectionData = await retrieveCollectionResponse(pool, collectionId, userId);
      return res.status(200).json(collectionData);
    } catch (retrievalErr) {
      log.error('Failed to retrieve collection after successful update', {
        userId,
        collectionId,
        error: retrievalErr && retrievalErr.message,
      });
      // Collection was updated successfully, but we can't return full data
      return res.status(200).json({
        collectionId,
        message: 'Collection updated successfully but full details unavailable'
      });
    }
  } catch (err) {
    try {
      await tx.rollback();
    } catch (rollbackErr) {
      log.error('transaction rollback failed', {
        userId,
        collectionId,
        rollbackError: rollbackErr && rollbackErr.message
      });
    }

    log.error('PATCH /collections/:id failed', {
      userId,
      collectionId,
      error: err && err.message,
      stack: err && err.stack
    });

    return res.status(500).json({
      error: 'database_error',
      message: 'Failed to update collection'
    });
  }
};
