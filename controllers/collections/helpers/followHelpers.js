const sql = require('mssql');

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
      (SELECT COUNT(*) FROM tblCollection_Follows WHERE Collection_ID = @collectionId) as followerCount,
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
    followerCount: row.followerCount,
    datasetCount: row.datasetCount
  };
}

async function createFollow(pool, userId, collectionId) {
  const request = new sql.Request(pool);
  request.input('userId', sql.Int, userId);
  request.input('collectionId', sql.Int, collectionId);

  const result = await request.query(`
    DECLARE @now DATETIME = GETDATE();
    DECLARE @inserted INT = 0;

    IF NOT EXISTS (
      SELECT 1 FROM tblCollection_Follows
      WHERE User_ID = @userId AND Collection_ID = @collectionId
    )
    BEGIN
      INSERT INTO tblCollection_Follows (User_ID, Collection_ID, Follow_Date)
      VALUES (@userId, @collectionId, @now);
      SET @inserted = 1;
    END

    SELECT @inserted as inserted, @now as followDate;
  `);

  if (result.recordset[0].inserted === 0) {
    return null;
  }
  return result.recordset[0].followDate;
}

async function deleteFollow(pool, userId, collectionId) {
  const request = new sql.Request(pool);
  request.input('userId', sql.Int, userId);
  request.input('collectionId', sql.Int, collectionId);

  const result = await request.query(`
    DELETE FROM tblCollection_Follows
    WHERE User_ID = @userId AND Collection_ID = @collectionId;
    SELECT @@ROWCOUNT as deleted;
  `);

  return result.recordset[0].deleted > 0;
}

module.exports = {
  getCollectionForFollowValidation,
  createFollow,
  deleteFollow
};
