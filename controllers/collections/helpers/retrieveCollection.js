const sql = require('mssql');
const initializeLogger = require('../../../log-service');

const log = initializeLogger('controllers/collections/helpers/retrieveCollection');

/**
 * Retrieve complete collection object with datasets after successful mutation.
 *
 * This helper is used by create, copy, and update endpoints to return
 * a consistent, comprehensive collection response to the client.
 *
 * @param {object} pool - Database connection pool
 * @param {number} collectionId - ID of collection to retrieve
 * @param {number} userId - ID of authenticated user (for isOwner calculation)
 * @returns {Promise<object>} Complete collection object with datasets
 * @throws {Error} If retrieval query fails
 */
async function retrieveCollectionResponse(pool, collectionId, userId) {
  const retrieveRequest = new sql.Request(pool);
  retrieveRequest.input('collectionId', sql.Int, collectionId);
  retrieveRequest.input('userId', sql.Int, userId);

  const retrieveQuery = `
    SELECT
      c.Collection_ID as id,
      c.Collection_Name as name,
      c.Description as description,
      CASE WHEN c.Private = 0 THEN 1 ELSE 0 END as isPublic,
      c.Created_At as createdDate,
      c.Modified_At as modifiedDate,
      u.FirstName + ' ' + u.FamilyName as ownerName,
      u.Institute as ownerAffiliation,
      COUNT(cd.Dataset_Short_Name) as datasetCount,
      CASE
        WHEN @userId IS NOT NULL AND c.User_ID = @userId THEN 1
        ELSE 0
      END as isOwner,
      c.Downloads as downloads,
      c.Views as views,
      c.Copies as copies
    FROM tblCollections c
    INNER JOIN tblUsers u ON c.User_ID = u.UserID
    LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
    WHERE c.Collection_ID = @collectionId
    GROUP BY c.Collection_ID, c.Collection_Name, c.Description, c.Private,
             c.Created_At, c.Modified_At, c.Downloads, c.Views, c.Copies,
             u.FirstName, u.FamilyName, u.Institute, c.User_ID;

    SELECT
      cd.Dataset_Short_Name as datasetShortName,
      d.Dataset_Long_Name as datasetLongName,
      CASE WHEN d.Dataset_Name IS NULL THEN 1 ELSE 0 END as isInvalid
    FROM tblCollection_Datasets cd
    LEFT JOIN tblDatasets d ON cd.Dataset_Short_Name = d.Dataset_Name
    WHERE cd.Collection_ID = @collectionId
    ORDER BY cd.Dataset_Short_Name
  `;

  const retrieveResult = await retrieveRequest.query(retrieveQuery);

  if (!retrieveResult.recordsets || !retrieveResult.recordsets[0] || retrieveResult.recordsets[0].length === 0) {
    log.error('Collection not found after mutation', {
      collectionId,
      userId
    });
    throw new Error('Collection not found after successful mutation');
  }

  const collection = retrieveResult.recordsets[0][0];

  // Build datasets array with isInvalid flag
  const datasetsArray = retrieveResult.recordsets[1]
    ? retrieveResult.recordsets[1].map(dataset => ({
        datasetShortName: dataset.datasetShortName,
        datasetLongName: dataset.datasetLongName,
        isInvalid: Boolean(dataset.isInvalid)
      }))
    : [];

  // Build response object
  const responseData = {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    isPublic: Boolean(collection.isPublic),
    createdDate: collection.createdDate ? new Date(collection.createdDate).toISOString() : null,
    modifiedDate: collection.modifiedDate ? new Date(collection.modifiedDate).toISOString() : null,
    ownerName: collection.ownerName,
    ownerAffiliation: collection.ownerAffiliation,
    datasetCount: collection.datasetCount,
    isOwner: Boolean(collection.isOwner),
    downloads: collection.downloads,
    views: collection.views,
    copies: collection.copies,
    datasets: datasetsArray
  };

  return responseData;
}

module.exports = retrieveCollectionResponse;
