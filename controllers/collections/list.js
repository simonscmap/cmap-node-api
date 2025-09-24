const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const nodeCache = require('../../utility/nodeCache');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/list');

const anonymousQuery = `
  SELECT c.Collection_ID as id,
         c.Collection_Name as name,
         c.Description as description,
         1 as is_public,
         c.Created_At as created_date,
         c.Modified_At as modified_date,
         u.firstName + ' ' + u.lastName as owner_name,
         u.affiliation as owner_affiliation,
         COUNT(cd.Dataset_Short_Name) as dataset_count,
         0 as is_owner
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.ID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  WHERE c.Private = 0
  GROUP BY c.Collection_ID, c.Collection_Name, c.Description, c.Private,
           c.Created_At, c.Modified_At,
           u.firstName, u.lastName, u.affiliation
  ORDER BY c.Modified_At DESC
`;

const authenticatedQuery = `
  SELECT c.Collection_ID as id,
         c.Collection_Name as name,
         c.Description as description,
         CASE WHEN c.Private = 0 THEN 1 ELSE 0 END as is_public,
         c.Created_At as created_date,
         c.Modified_At as modified_date,
         u.firstName + ' ' + u.lastName as owner_name,
         u.affiliation as owner_affiliation,
         COUNT(cd.Dataset_Short_Name) as dataset_count,
         CASE WHEN c.User_ID = @userId THEN 1 ELSE 0 END as is_owner
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.ID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  WHERE c.Private = 0 OR c.User_ID = @userId
  GROUP BY c.Collection_ID, c.Collection_Name, c.Description, c.Private,
           c.Created_At, c.Modified_At, c.Downloads, c.Views,
           u.firstName, u.lastName, u.affiliation, c.User_ID
  ORDER BY c.Modified_At DESC
`;

const queryWithDatasets = `
  SELECT c.Collection_ID as id,
         c.Collection_Name as name,
         c.Description as description,
         CASE WHEN c.Private = 0 THEN 1 ELSE 0 END as is_public,
         c.Created_At as created_date,
         c.Modified_At as modified_date,
         u.firstName + ' ' + u.lastName as owner_name,
         u.affiliation as owner_affiliation,
         CASE WHEN c.User_ID = @userId THEN 1 ELSE 0 END as is_owner,
         cd.Dataset_Short_Name as dataset_short_name,
         d.Dataset_Long_Name as dataset_long_name,
         d.Dataset_Version as dataset_version,
         CASE WHEN d.Dataset_Name IS NOT NULL THEN 1 ELSE 0 END as is_valid
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.ID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  LEFT JOIN tblDatasets d ON cd.Dataset_Short_Name = d.Dataset_Name
  WHERE `;

const anonymousQueryWithDatasets = `
  SELECT c.Collection_ID as id,
         c.Collection_Name as name,
         c.Description as description,
         1 as is_public,
         c.Created_At as created_date,
         c.Modified_At as modified_date,
         u.firstName + ' ' + u.lastName as owner_name,
         u.affiliation as owner_affiliation,
         0 as is_owner,
         cd.Dataset_Short_Name as dataset_short_name,
         d.Dataset_Long_Name as dataset_long_name,
         d.Dataset_Version as dataset_version,
         CASE WHEN d.Dataset_Name IS NOT NULL THEN 1 ELSE 0 END as is_valid
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.ID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  LEFT JOIN tblDatasets d ON cd.Dataset_Short_Name = d.Dataset_Name
  WHERE c.Private = 0
  ORDER BY c.Modified_At DESC, cd.Dataset_Short_Name
`;

function validateQueryParams(query) {
  const errors = [];

  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push('limit must be between 1 and 100');
    }
  }

  if (query.offset !== undefined) {
    const offset = parseInt(query.offset, 10);
    if (isNaN(offset) || offset < 0) {
      errors.push('offset must be 0 or greater');
    }
  }

  return errors;
}

function transformResultsWithDatasets(results, includeDatasets) {
  if (!includeDatasets) {
    return results;
  }

  const collectionsMap = new Map();

  results.forEach(row => {
    const collectionId = row.id;

    if (!collectionsMap.has(collectionId)) {
      collectionsMap.set(collectionId, {
        id: row.id,
        name: row.name,
        description: row.description,
        is_public: Boolean(row.is_public),
        created_date: row.created_date,
        modified_date: row.modified_date,
        owner_name: row.owner_name,
        owner_affiliation: row.owner_affiliation,
        dataset_count: 0,
        is_owner: Boolean(row.is_owner),
        datasets: []
      });
    }

    const collection = collectionsMap.get(collectionId);

    if (row.dataset_short_name) {
      collection.datasets.push({
        dataset_short_name: row.dataset_short_name,
        dataset_long_name: row.dataset_long_name,
        dataset_version: row.dataset_version,
        is_valid: Boolean(row.is_valid)
      });
    }

    collection.dataset_count = collection.datasets.length;
  });

  return Array.from(collectionsMap.values());
}

module.exports = async (req, res) => {
  log.trace('requesting collections list');

  const validationErrors = validateQueryParams(req.query);
  if (validationErrors.length > 0) {
    log.warn('invalid query parameters', { errors: validationErrors });
    return res.status(400).json({
      error: 'validation_error',
      message: validationErrors.join(', ')
    });
  }

  const includeDatasets = req.query.includeDatasets === 'true';
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
  const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
  const userId = req.user ? req.user.id : null;
  const isAuthenticated = Boolean(userId);

  const cacheKey = `collections:list:${isAuthenticated ? userId : 'anonymous'}:${includeDatasets}:${limit}:${offset}`;
  const cachedResult = nodeCache.get(cacheKey);

  if (cachedResult) {
    log.trace('returning cached collections list');
    return res.status(200).json(cachedResult);
  }

  try {
    const pool = await pools.userReadAndWritePool;
    const request = new sql.Request(pool);

    let query;
    if (includeDatasets) {
      if (isAuthenticated) {
        query = queryWithDatasets + 'c.Private = 0 OR c.User_ID = @userId ORDER BY c.Modified_At DESC, cd.Dataset_Short_Name';
        request.input('userId', sql.Int, userId);
      } else {
        query = anonymousQueryWithDatasets;
      }
    } else {
      if (isAuthenticated) {
        query = authenticatedQuery;
        request.input('userId', sql.Int, userId);
      } else {
        query = anonymousQuery;
      }
    }

    const result = await request.query(query);
    let collections;

    if (includeDatasets) {
      collections = transformResultsWithDatasets(result.recordset, true);
    } else {
      collections = result.recordset.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        is_public: Boolean(row.is_public),
        created_date: row.created_date,
        modified_date: row.modified_date,
        owner_name: row.owner_name,
        owner_affiliation: row.owner_affiliation,
        dataset_count: row.dataset_count,
        is_owner: Boolean(row.is_owner)
      }));
    }

    const paginatedResults = collections.slice(offset, offset + limit);

    const ttl = isAuthenticated ? 30 * 60 : 60 * 60;
    nodeCache.set(cacheKey, paginatedResults, ttl);

    log.trace('returning collections list', { count: paginatedResults.length });
    res.status(200).json(paginatedResults);

  } catch (error) {
    log.error('error retrieving collections list', { error: error.message });
    res.status(500).json({
      error: 'server_error',
      message: 'Error retrieving collections'
    });
  }
};