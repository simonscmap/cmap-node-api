const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/get');

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
         0 as isOwner,
         c.Downloads as downloads,
         c.Views as views,
         c.Copies as copies
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.UserID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  WHERE c.Private = 0
  GROUP BY c.Collection_ID, c.Collection_Name, c.Description, c.Private,
           c.Created_At, c.Modified_At, c.Downloads, c.Views, c.Copies,
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
         CASE WHEN c.User_ID = @userId THEN 1 ELSE 0 END as isOwner,
         c.Downloads as downloads,
         c.Views as views,
         c.Copies as copies
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.UserID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  WHERE c.Private = 0 OR c.User_ID = @userId
  GROUP BY c.Collection_ID, c.Collection_Name, c.Description, c.Private,
           c.Created_At, c.Modified_At, c.Downloads, c.Views, c.Copies,
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
         c.Downloads as downloads,
         c.Views as views,
         c.Copies as copies,
         cd.Dataset_Short_Name as datasetShortName,
         d.Dataset_Long_Name as datasetLongName,
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
         c.Downloads as downloads,
         c.Views as views,
         c.Copies as copies,
         cd.Dataset_Short_Name as datasetShortName,
         d.Dataset_Long_Name as datasetLongName,
         CASE WHEN d.Dataset_Name IS NOT NULL THEN 1 ELSE 0 END as isValid
  FROM tblCollections c
  INNER JOIN tblUsers u ON c.User_ID = u.UserID
  LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
  LEFT JOIN tblDatasets d ON cd.Dataset_Short_Name = d.Dataset_Name
  WHERE c.Private = 0
  ORDER BY c.Modified_At DESC, cd.Dataset_Short_Name
`;

function transformResultsWithDatasets(results, includeDatasets) {
  if (!includeDatasets) {
    return results;
  }

  const collectionsMap = new Map();

  results.forEach((row) => {
    const collectionId = row.id;

    if (!collectionsMap.has(collectionId)) {
      collectionsMap.set(collectionId, {
        id: row.id,
        name: row.name,
        description: row.description,
        isPublic: Boolean(row.isPublic),
        createdDate: row.createdDate
          ? new Date(row.createdDate).toISOString()
          : null,
        modifiedDate: row.modifiedDate
          ? new Date(row.modifiedDate).toISOString()
          : null,
        ownerName: row.ownerName,
        ownerAffiliation: row.ownerAffiliation,
        datasetCount: 0,
        isOwner: Boolean(row.isOwner),
        downloads: row.downloads,
        views: row.views,
        copies: row.copies,
        datasets: [],
      });
    }

    const collection = collectionsMap.get(collectionId);

    if (row.datasetShortName) {
      collection.datasets.push({
        datasetShortName: row.datasetShortName,
        datasetLongName: row.datasetLongName,
        isValid: Boolean(row.isValid),
      });
    }

    collection.datasetCount = collection.datasets.length;
  });

  return Array.from(collectionsMap.values());
}

module.exports = async (req, res) => {
  log.info('requesting collections list');

  // Use validated parameters from middleware
  const { includeDatasets } = req.validatedQuery;
  // TODO: Re-enable when implementing backend pagination
  // const { limit, offset } = req.validatedQuery;
  const userId = req.user ? req.user.id : null;
  const isAuthenticated = req.isAuthenticated();

  log.info('collection list request parameters', {
    userId,
    isAuthenticatedFromPassport: isAuthenticated,
    hasReqUser: Boolean(req.user),
    reqUser: req.user,
    includeDatasets,
    // limit,
    // offset,
  });

  // CACHING DISABLED
  // const cacheKey = `collections:list:${
  //   isAuthenticated ? userId : 'anonymous'
  // }:${includeDatasets}:${limit}:${offset}`;
  // const cachedResult = nodeCache.get(cacheKey);

  // if (cachedResult) {
  //   log.info('returning cached collections list', {
  //     cacheKey,
  //     resultCount: cachedResult.length,
  //   });
  //   return res.status(200).json(cachedResult);
  // }

  try {
    const pool = await pools.userReadAndWritePool;
    const request = new sql.Request(pool);

    let query;
    if (includeDatasets) {
      if (isAuthenticated) {
        query =
          queryWithDatasets +
          'c.Private = 0 OR c.User_ID = @userId ORDER BY c.Modified_At DESC, cd.Dataset_Short_Name';
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
      isAuthenticated,
    });

    const result = await request.query(query);
    let collections;

    if (includeDatasets) {
      collections = transformResultsWithDatasets(result.recordset, true);
    } else {
      collections = result.recordset.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isPublic: Boolean(row.isPublic),
        createdDate: row.createdDate
          ? new Date(row.createdDate).toISOString()
          : null,
        modifiedDate: row.modifiedDate
          ? new Date(row.modifiedDate).toISOString()
          : null,
        ownerName: row.ownerName,
        ownerAffiliation: row.ownerAffiliation,
        datasetCount: row.datasetCount,
        isOwner: Boolean(row.isOwner),
        downloads: row.downloads,
        views: row.views,
        copies: row.copies,
      }));
    }

    log.info('query results', {
      totalCollections: collections.length,
      // requestedLimit: limit,
      // requestedOffset: offset,
    });

    // TODO: Re-enable when implementing backend pagination
    // Currently returning all collections for frontend pagination
    // const paginatedResults = collections.slice(offset, offset + limit);

    // CACHING DISABLED
    // const ttl = isAuthenticated ? 30 * 60 : 60 * 60;
    // nodeCache.set(cacheKey, collections, ttl);

    log.info('returning collections list', {
      count: collections.length,
      // cacheTTL: ttl,
    });
    res.status(200).json(collections);
  } catch (error) {
    log.error('error retrieving collections list', { error: error.message });
    res.status(500).json({
      error: 'server_error',
      message: 'Error retrieving collections',
    });
  }
};
