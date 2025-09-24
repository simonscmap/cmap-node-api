const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/detail');

module.exports = async (req, res) => {
  const collectionId = parseInt(req.params.id);
  const includeDatasets = req.query.includeDatasets !== 'false'; // Default to true for detail endpoint
  const userId = req.user ? req.user.id : null;

  if (!collectionId || isNaN(collectionId) || collectionId < 1) {
    return res.status(404).send('Collection does not exist');
  }

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
      c.ID as id,
      c.Name as name,
      c.Description as description,
      c.Is_Public as is_public,
      c.Created_Date as created_date,
      c.Modified_Date as modified_date,
      u.First_Name + ' ' + u.Last_Name as owner_name,
      u.Affiliation as owner_affiliation,
      c.Dataset_Count as dataset_count,
      CASE
        WHEN @userId IS NOT NULL AND c.User_ID = @userId THEN 1
        ELSE 0
      END as is_owner,
      CASE
        WHEN @userId IS NOT NULL AND c.User_ID = @userId THEN c.Total_Downloads
        ELSE NULL
      END as total_downloads
    FROM tblCollections c
    INNER JOIN tblUsers u ON c.User_ID = u.ID
    WHERE c.ID = @collectionId
      AND (c.Is_Public = 1 OR (@userId IS NOT NULL AND c.User_ID = @userId))
  `;

  // Query to get collection datasets if requested
  const datasetsQuery = includeDatasets ? `
    SELECT
      cd.Dataset_ID as dataset_id,
      d.Dataset_Name as dataset_short_name,
      d.Long_Name as dataset_long_name,
      d.Dataset_Version as dataset_version,
      CASE WHEN d.Dataset_ID IS NOT NULL THEN 1 ELSE 0 END as is_valid,
      cd.Added_Date as added_date,
      cd.Display_Order as display_order
    FROM tblCollection_Datasets cd
    LEFT JOIN tblDatasets d ON cd.Dataset_ID = d.Dataset_ID
    WHERE cd.Collection_ID = @collectionId
    ORDER BY
      CASE WHEN cd.Display_Order IS NULL THEN 1 ELSE 0 END,
      cd.Display_Order,
      cd.Added_Date
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
      dataset_id: dataset.dataset_id,
      dataset_short_name: dataset.dataset_short_name,
      dataset_long_name: dataset.dataset_long_name,
      dataset_version: dataset.dataset_version,
      is_valid: Boolean(dataset.is_valid),
      added_date: dataset.added_date,
      display_order: dataset.display_order
    }));
  } else {
    collection.datasets = [];
  }

  // Convert boolean fields and ensure proper types
  const responseData = {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    is_public: Boolean(collection.is_public),
    created_date: collection.created_date,
    modified_date: collection.modified_date,
    owner_name: collection.owner_name,
    owner_affiliation: collection.owner_affiliation,
    dataset_count: collection.dataset_count,
    is_owner: Boolean(collection.is_owner),
    datasets: collection.datasets
  };

  // Only include total_downloads if user is owner
  if (collection.total_downloads !== null) {
    responseData.total_downloads = collection.total_downloads;
  }

  log.trace('Collection detail retrieved successfully', {
    collectionId,
    userId,
    isOwner: responseData.is_owner,
    datasetCount: responseData.datasets.length
  });

  res.status(200).json(responseData);
};