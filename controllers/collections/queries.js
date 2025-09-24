const sql = require('mssql');

// Collection List Queries

// Anonymous users - public collections only
const getPublicCollectionsQuery = () => `
SELECT c.Collection_ID as id,
       c.Collection_Name as name,
       c.Description as description,
       1 as is_public,
       c.Created_At as created_date,
       c.Modified_At as modified_date,
       u.FirstName + ' ' + u.FamilyName as owner_name,
       u.Institute as owner_affiliation,
       COUNT(cd.Dataset_Short_Name) as dataset_count,
       0 as is_owner
FROM tblCollections c
INNER JOIN tblUsers u ON c.User_ID = u.ID
LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
WHERE c.Private = 0
GROUP BY c.Collection_ID, c.Collection_Name, c.Description, c.Private,
         c.Created_At, c.Modified_At,
         u.FirstName, u.FamilyName, u.Institute
ORDER BY c.Modified_At DESC;
`;

// Authenticated users - public collections plus own private collections
const getCollectionsWithUserQuery = () => `
SELECT c.Collection_ID as id,
       c.Collection_Name as name,
       c.Description as description,
       CASE WHEN c.Private = 0 THEN 1 ELSE 0 END as is_public,
       c.Created_At as created_date,
       c.Modified_At as modified_date,
       u.FirstName + ' ' + u.FamilyName as owner_name,
       u.Institute as owner_affiliation,
       COUNT(cd.Dataset_Short_Name) as dataset_count,
       CASE WHEN c.User_ID = @userId THEN 1 ELSE 0 END as is_owner,
       CASE WHEN c.User_ID = @userId THEN c.Downloads ELSE NULL END as total_downloads,
       CASE WHEN c.User_ID = @userId THEN c.Views ELSE NULL END as total_views
FROM tblCollections c
INNER JOIN tblUsers u ON c.User_ID = u.ID
LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
WHERE c.Private = 0 OR c.User_ID = @userId
GROUP BY c.Collection_ID, c.Collection_Name, c.Description, c.Private,
         c.Created_At, c.Modified_At, c.Downloads, c.Views,
         u.FirstName, u.FamilyName, u.Institute, c.User_ID
ORDER BY c.Modified_At DESC;
`;

// Collection Detail Queries

// Get individual collection with datasets (for both authenticated and anonymous users)
const getCollectionDetailQuery = () => `
SELECT c.Collection_ID as id,
       c.Collection_Name as name,
       c.Description as description,
       CASE WHEN c.Private = 0 THEN 1 ELSE 0 END as is_public,
       c.Created_At as created_date,
       c.Modified_At as modified_date,
       u.FirstName + ' ' + u.FamilyName as owner_name,
       u.Institute as owner_affiliation,
       CASE WHEN c.User_ID = @userId THEN 1 ELSE 0 END as is_owner,
       CASE WHEN c.User_ID = @userId THEN c.Downloads ELSE NULL END as total_downloads,
       CASE WHEN c.User_ID = @userId THEN c.Views ELSE NULL END as total_views,
       cd.Dataset_Short_Name as dataset_short_name,
       d.Dataset_Long_Name as dataset_long_name,
       d.Dataset_Version as dataset_version,
       CASE WHEN d.Dataset_Name IS NOT NULL THEN 1 ELSE 0 END as is_valid
FROM tblCollections c
INNER JOIN tblUsers u ON c.User_ID = u.ID
LEFT JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
LEFT JOIN tblDatasets d ON cd.Dataset_Short_Name = d.Dataset_Name
WHERE c.Collection_ID = @collectionId
  AND (c.Private = 0 OR c.User_ID = @userId)
ORDER BY cd.Dataset_Short_Name;
`;

// Check if collection exists and user has access (for access control)
const getCollectionAccessQuery = () => `
SELECT c.Collection_ID as id,
       c.Private as private,
       c.User_ID as owner_id,
       CASE WHEN c.User_ID = @userId THEN 1 ELSE 0 END as is_owner
FROM tblCollections c
WHERE c.Collection_ID = @collectionId;
`;

// Query builders with parameters

const buildPublicCollectionsRequest = () => {
  const request = new sql.Request();
  return {
    query: getPublicCollectionsQuery(),
    request
  };
};

const buildCollectionsWithUserRequest = (userId) => {
  const request = new sql.Request();
  request.input('userId', sql.Int, userId);
  return {
    query: getCollectionsWithUserQuery(),
    request
  };
};

const buildCollectionDetailRequest = (collectionId, userId = null) => {
  const request = new sql.Request();
  request.input('collectionId', sql.Int, collectionId);
  if (userId !== null) {
    request.input('userId', sql.Int, userId);
  } else {
    request.input('userId', sql.Int, -1); // Anonymous user ID
  }
  return {
    query: getCollectionDetailQuery(),
    request
  };
};

const buildCollectionAccessRequest = (collectionId, userId = null) => {
  const request = new sql.Request();
  request.input('collectionId', sql.Int, collectionId);
  if (userId !== null) {
    request.input('userId', sql.Int, userId);
  } else {
    request.input('userId', sql.Int, -1); // Anonymous user ID
  }
  return {
    query: getCollectionAccessQuery(),
    request
  };
};

module.exports = {
  // Query builders
  buildPublicCollectionsRequest,
  buildCollectionsWithUserRequest,
  buildCollectionDetailRequest,
  buildCollectionAccessRequest,

  // Raw queries (for testing or advanced use)
  getPublicCollectionsQuery,
  getCollectionsWithUserQuery,
  getCollectionDetailQuery,
  getCollectionAccessQuery
};