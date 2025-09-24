const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/detail');

module.exports = async (req, res) => {
  // Use validated parameters from middleware
  const collectionId = req.validatedParams.id;
  const { includeDatasets } = req.validatedQuery;
  const userId = req.user ? req.user.id : null;

  let pool;
  try {
    pool = await pools.userReadAndWritePool;
  } catch (error) {
    log.error('Failed to get database pool', { error, collectionId });
    return res.status(500).send('Database connection error');
  }

  const request = new sql.Request(pool);
  request.input('collectionId', sql.Int, collectionId);
  request.input('userId', sql.Int, userId);

  // Query to get collection details with access control
  const collectionQuery = `
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
      CASE
        WHEN @userId IS NOT NULL AND c.User_ID = @userId THEN c.Downloads
        ELSE NULL
      END as totalDownloads
    FROM tblCollections c
    INNER JOIN tblUsers u ON c.User_ID = u.UserID
    LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
    WHERE c.Collection_ID = @collectionId
      AND (c.Private = 0 OR (@userId IS NOT NULL AND c.User_ID = @userId))
    GROUP BY c.Collection_ID, c.Collection_Name, c.Description, c.Private,
             c.Created_At, c.Modified_At, c.Downloads,
             u.FirstName, u.FamilyName, u.Institute, c.User_ID
  `;

  // Query to get collection datasets if requested
  const datasetsQuery = includeDatasets ? `
    SELECT
      cd.Dataset_Short_Name as datasetShortName,
      d.Dataset_Long_Name as datasetLongName,
      d.Dataset_Name as datasetName,
      CASE WHEN d.Dataset_Name IS NOT NULL THEN 1 ELSE 0 END as isValid
    FROM tblCollection_Datasets cd
    LEFT JOIN tblDatasets d ON cd.Dataset_Short_Name = d.Dataset_Name
    WHERE cd.Collection_ID = @collectionId
    ORDER BY cd.Dataset_Short_Name
  ` : '';

  const query = datasetsQuery ? collectionQuery + '; ' + datasetsQuery : collectionQuery;

  let result;
  try {
    result = await request.query(query);
  } catch (error) {
    log.error('Error executing collection detail query', {
      error,
      collectionId,
      userId
    });
    return res.status(500).send('Error retrieving collection details');
  }

  const collections = result.recordsets[0];
  if (!collections || collections.length === 0) {
    return res.status(404).send('Collection does not exist');
  }

  const collection = collections[0];

  // Add datasets if requested and available
  if (includeDatasets && result.recordsets[1]) {
    collection.datasets = result.recordsets[1].map(dataset => ({
      datasetShortName: dataset.datasetShortName,
      datasetLongName: dataset.datasetLongName,
      datasetName: dataset.datasetName,
      isValid: Boolean(dataset.isValid)
    }));
  } else {
    collection.datasets = [];
  }

  // Convert boolean fields and ensure proper types
  const responseData = {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    isPublic: Boolean(collection.isPublic),
    createdDate: collection.createdDate,
    modifiedDate: collection.modifiedDate,
    ownerName: collection.ownerName,
    ownerAffiliation: collection.ownerAffiliation,
    datasetCount: collection.datasetCount,
    isOwner: Boolean(collection.isOwner),
    datasets: collection.datasets
  };

  // Only include total_downloads if user is owner
  if (collection.totalDownloads !== null) {
    responseData.totalDownloads = collection.totalDownloads;
  }

  log.trace('Collection detail retrieved successfully', {
    collectionId,
    userId,
    isOwner: responseData.isOwner,
    datasetCount: responseData.datasets.length
  });

  res.status(200).json(responseData);
};