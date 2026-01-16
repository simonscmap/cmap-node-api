const sql = require('mssql');

async function isUserFollowing(pool, userId, collectionId) {
  const request = new sql.Request(pool);
  request.input('userId', sql.Int, userId);
  request.input('collectionId', sql.Int, collectionId);

  const result = await request.query(`
    SELECT 1
    FROM tblCollection_Follows
    WHERE User_ID = @userId AND Collection_ID = @collectionId
  `);

  return result.recordset.length > 0;
}

async function getCollectionForFollowValidation(pool, collectionId) {
  const request = new sql.Request(pool);
  request.input('collectionId', sql.Int, collectionId);

  const result = await request.query(`
    SELECT
      c.Collection_ID as id,
      c.User_ID as ownerId,
      c.Collection_Name as name,
      c.Private as isPrivate,
      u.FirstName + ' ' + u.FamilyName as ownerName,
      (SELECT COUNT(*) FROM tblCollection_Follows WHERE Collection_ID = @collectionId) as follows,
      (SELECT COUNT(*) FROM tblCollection_Datasets WHERE Collection_ID = @collectionId) as datasetCount
    FROM tblCollections c
    INNER JOIN tblUsers u ON c.User_ID = u.UserID
    WHERE c.Collection_ID = @collectionId
  `);

  if (result.recordset.length === 0) {
    return null;
  }

  const row = result.recordset[0];
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    isPrivate: Boolean(row.isPrivate),
    ownerName: row.ownerName,
    follows: row.follows,
    datasetCount: row.datasetCount
  };
}

async function createFollow(pool, userId, collectionId) {
  const request = new sql.Request(pool);
  request.input('userId', sql.Int, userId);
  request.input('collectionId', sql.Int, collectionId);

  const result = await request.query(`
    INSERT INTO tblCollection_Follows (User_ID, Collection_ID, Follow_Date)
    OUTPUT INSERTED.Follow_Date as followDate
    VALUES (@userId, @collectionId, GETDATE())
  `);

  return result.recordset[0].followDate;
}

async function deleteFollow(pool, userId, collectionId) {
  const request = new sql.Request(pool);
  request.input('userId', sql.Int, userId);
  request.input('collectionId', sql.Int, collectionId);

  await request.query(`
    DELETE FROM tblCollection_Follows
    WHERE User_ID = @userId AND Collection_ID = @collectionId
  `);
}

module.exports = {
  isUserFollowing,
  getCollectionForFollowValidation,
  createFollow,
  deleteFollow
};
