/**
 * Collections Database Schema Documentation
 *
 * This file documents the SQL Server tables used by the collections feature.
 * Use this as a reference when writing queries or understanding data structures.
 */

/**
 * TABLE: tblCollections
 *
 * Stores collection metadata including ownership, visibility, and usage statistics.
 *
 * @typedef {Object} tblCollections
 * @property {number} Collection_ID - Primary key, auto-increment
 * @property {number} User_ID - Foreign key to user table
 * @property {string} Collection_Name - Collection name, nvarchar(200)
 * @property {boolean} Private - Visibility flag, bit (1=private, 0=public)
 * @property {string} Description - Collection description, nvarchar(500), nullable
 * @property {number} Downloads - Download count, int, default 0
 * @property {number} Views - View count, int, default 0
 * @property {Date} Created_At - Creation timestamp, datetime
 * @property {Date} Modified_At - Last modified timestamp, datetime
 *
 * @example
 * // Query example
 * SELECT * FROM tblCollections WHERE User_ID = @userId AND Private = 0
 */

/**
 * TABLE: tblCollection_Datasets
 *
 * Junction table linking collections to datasets (many-to-many relationship).
 * Composite primary key on (Collection_ID, Dataset_Short_Name).
 *
 * @typedef {Object} tblCollection_Datasets
 * @property {number} Collection_ID - Foreign key to tblCollections.Collection_ID
 * @property {string} Dataset_Short_Name - Foreign key to dataset table, nvarchar(100)
 *
 * @example
 * // Query example - get all datasets in a collection
 * SELECT Dataset_Short_Name
 * FROM tblCollection_Datasets
 * WHERE Collection_ID = @collectionId
 *
 * @example
 * // Query example - get collections containing a specific dataset
 * SELECT c.*
 * FROM tblCollections c
 * INNER JOIN tblCollection_Datasets cd ON c.Collection_ID = cd.Collection_ID
 * WHERE cd.Dataset_Short_Name = @datasetName
 */

module.exports = {
  // This file is for documentation purposes only
  // No exports needed
};