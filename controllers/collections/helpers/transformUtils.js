const mapCollectionFields = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  isPublic: Boolean(row.isPublic),
  createdDate: row.createdDate ? new Date(row.createdDate).toISOString() : null,
  modifiedDate: row.modifiedDate ? new Date(row.modifiedDate).toISOString() : null,
  followDate: row.followDate ? new Date(row.followDate).toISOString() : null,
  ownerName: row.ownerName,
  ownerAffiliation: row.ownerAffiliation,
  isOwner: Boolean(row.isOwner),
  isFollowing: Boolean(row.isFollowing),
  downloads: row.downloads,
  views: row.views,
  copies: row.copies,
  followerCount: row.followerCount,
});

function transformResultsWithDatasets(results) {
  const collectionsMap = new Map();

  results.forEach((row) => {
    const collectionId = row.id;

    if (!collectionsMap.has(collectionId)) {
      collectionsMap.set(collectionId, {
        ...mapCollectionFields(row),
        datasetCount: 0,
        datasets: [],
      });
    }

    const collection = collectionsMap.get(collectionId);

    if (row.datasetShortName) {
      collection.datasets.push({
        datasetShortName: row.datasetShortName,
        datasetLongName: row.datasetLongName,
        isInvalid: Boolean(row.isInvalid),
      });
    }

    collection.datasetCount = collection.datasets.length;
  });

  return Array.from(collectionsMap.values());
}

module.exports = {
  mapCollectionFields,
  transformResultsWithDatasets,
};
