const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const nodeCache = require('../../utility/nodeCache');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/list');

const anonymousQuery = `
  SELECT c.Collection_ID as id,
         c.Collection_Name as name,
         c.Description as description,
         1 as isPublic,
         c.Created_At as createdDate,
         c.Modified_At as modifiedDate,
         u.FirstName + ' ' + u.FamilyName as ownerName,
         u.Institute as ownerAffiliation,
         COUNT(cd.Dataset_Short_Name) as datasetCount,
         0 as isOwner
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.UserID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  WHERE c.Private = 0
  GROUP BY c.Collection_ID, c.Collection_Name, c.Description, c.Private,
           c.Created_At, c.Modified_At,
           u.FirstName, u.FamilyName, u.Institute
  ORDER BY c.Modified_At DESC
`;

const authenticatedQuery = `
  SELECT c.Collection_ID as id,
         c.Collection_Name as name,
         c.Description as description,
         CASE WHEN c.Private = 0 THEN 1 ELSE 0 END as isPublic,
         c.Created_At as createdDate,
         c.Modified_At as modifiedDate,
         u.FirstName + ' ' + u.FamilyName as ownerName,
         u.Institute as ownerAffiliation,
         COUNT(cd.Dataset_Short_Name) as datasetCount,
         CASE WHEN c.User_ID = @userId THEN 1 ELSE 0 END as isOwner
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.UserID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  WHERE c.Private = 0 OR c.User_ID = @userId
  GROUP BY c.Collection_ID, c.Collection_Name, c.Description, c.Private,
           c.Created_At, c.Modified_At, c.Downloads, c.Views,
           u.FirstName, u.FamilyName, u.Institute, c.User_ID
  ORDER BY c.Modified_At DESC
`;

const queryWithDatasets = `
  SELECT c.Collection_ID as id,
         c.Collection_Name as name,
         c.Description as description,
         CASE WHEN c.Private = 0 THEN 1 ELSE 0 END as isPublic,
         c.Created_At as createdDate,
         c.Modified_At as modifiedDate,
         u.FirstName + ' ' + u.FamilyName as ownerName,
         u.Institute as ownerAffiliation,
         CASE WHEN c.User_ID = @userId THEN 1 ELSE 0 END as isOwner,
         cd.Dataset_Short_Name as datasetShortName,
         d.Dataset_Long_Name as datasetLongName,
         d.Dataset_Version as datasetVersion,
         CASE WHEN d.Dataset_Name IS NOT NULL THEN 1 ELSE 0 END as isValid
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.UserID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  LEFT JOIN tblDatasets d ON cd.Dataset_Short_Name = d.Dataset_Name
  WHERE `;

const anonymousQueryWithDatasets = `
  SELECT c.Collection_ID as id,
         c.Collection_Name as name,
         c.Description as description,
         1 as isPublic,
         c.Created_At as createdDate,
         c.Modified_At as modifiedDate,
         u.FirstName + ' ' + u.FamilyName as ownerName,
         u.Institute as ownerAffiliation,
         0 as isOwner,
         cd.Dataset_Short_Name as datasetShortName,
         d.Dataset_Long_Name as datasetLongName,
         d.Dataset_Version as datasetVersion,
         CASE WHEN d.Dataset_Name IS NOT NULL THEN 1 ELSE 0 END as isValid
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.UserID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  LEFT JOIN tblDatasets d ON cd.Dataset_Short_Name = d.Dataset_Name
  WHERE c.Private = 0
  ORDER BY c.Modified_At DESC, cd.Dataset_Short_Name
`;

// Validation is now handled by middleware, this function is no longer needed
// function validateQueryParams(query) {
//   const errors = [];
//
//   if (query.limit !== undefined) {
//     const limit = parseInt(query.limit, 10);
//     if (isNaN(limit) || limit < 1 || limit > 100) {
//       errors.push('limit must be between 1 and 100');
//     }
//   }
//
//   if (query.offset !== undefined) {
//     const offset = parseInt(query.offset, 10);
//     if (isNaN(offset) || offset < 0) {
//       errors.push('offset must be 0 or greater');
//     }
//   }
//
//   return errors;
// }

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
        isPublic: Boolean(row.isPublic),
        createdDate: row.createdDate,
        modifiedDate: row.modifiedDate,
        ownerName: row.ownerName,
        ownerAffiliation: row.ownerAffiliation,
        datasetCount: 0,
        isOwner: Boolean(row.isOwner),
        datasets: []
      });
    }

    const collection = collectionsMap.get(collectionId);

    if (row.datasetShortName) {
      collection.datasets.push({
        datasetShortName: row.datasetShortName,
        datasetLongName: row.datasetLongName,
        datasetVersion: row.datasetVersion,
        isValid: Boolean(row.isValid)
      });
    }

    collection.datasetCount = collection.datasets.length;
  });

  return Array.from(collectionsMap.values());
}

module.exports = async (req, res) => {
  log.info('requesting collections list');

  // Use validated parameters from middleware
  const { includeDatasets, limit, offset } = req.validatedQuery;
  const userId = req.user ? req.user.id : null;
  const isAuthenticated = Boolean(userId);

  log.info('collection list request parameters', {
    userId,
    isAuthenticated,
    includeDatasets,
    limit,
    offset
  });

  const cacheKey = `collections:list:${isAuthenticated ? userId : 'anonymous'}:${includeDatasets}:${limit}:${offset}`;
  const cachedResult = nodeCache.get(cacheKey);

  if (cachedResult) {
    log.info('returning cached collections list', {
      cacheKey,
      resultCount: cachedResult.length
    });
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

    log.info('executing query', {
      queryType: includeDatasets ? 'withDatasets' : 'simple',
      isAuthenticated
    });

    const result = await request.query(query);
    let collections;

    if (includeDatasets) {
      collections = transformResultsWithDatasets(result.recordset, true);
    } else {
      collections = result.recordset.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isPublic: Boolean(row.isPublic),
        createdDate: row.createdDate,
        modifiedDate: row.modifiedDate,
        ownerName: row.ownerName,
        ownerAffiliation: row.ownerAffiliation,
        datasetCount: row.datasetCount,
        isOwner: Boolean(row.isOwner)
      }));
    }

    log.info('query results', {
      totalCollections: collections.length,
      requestedLimit: limit,
      requestedOffset: offset,
      collections
    });

    log.info('query results flattened', {
      totalCollections: collections.length,
      requestedLimit: limit,
      requestedOffset: offset,
      collectionIds: collections.map(c => c.id),
      collectionNames: collections.map(c => c.name),
      datasetCounts: collections.map(c => c.datasetCount),
      isPublic: collections.map(c => c.isPublic),
      isOwner: collections.map(c => c.isOwner)
    });

    const paginatedResults = collections.slice(offset, offset + limit);

    const ttl = isAuthenticated ? 30 * 60 : 60 * 60;
    nodeCache.set(cacheKey, paginatedResults, ttl);

    log.info('returning collections list', {
      count: paginatedResults.length,
      cacheTTL: ttl
    });
    res.status(200).json(paginatedResults);

  } catch (error) {
    log.error('error retrieving collections list', { error: error.message });
    res.status(500).json({
      error: 'server_error',
      message: 'Error retrieving collections'
    });
  }
};