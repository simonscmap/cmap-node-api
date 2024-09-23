const sql = require("mssql");
const pools = require("../../dbHandlers/dbPools");
const datasetShortNamesFullList = require ('../catalog/datasetShortNamesFullList');
const initializeLogger = require("../../log-service");

let query = `SELECT TOP (1000)
       [ID] as id
      ,[headline]
      ,[link]
      ,[label]
      ,[body]
      ,[date]
      ,[rank]
      ,[view_status]
      ,[create_date]
      ,[modify_date]
      ,[publish_date]
      ,[Status_ID]
  FROM [Opedia].[dbo].[tblNews]
  WHERE view_status > 0;
  SELECT * FROM tblNews_Datasets;
`;

const log = initializeLogger("controllers/news/list");


const mergeResults = (newsItems, tags, datasetNames) => {
  return newsItems.map ((item) => {
    item.tags = tags
      .filter ((t) => t.News_ID === item.id)
      .map ((t) => {
        const d = datasetNames.find ((n) => n.ID === t.Dataset_ID);
        if (d) {
          return d.Dataset_Name;
        } else {
          log.warn (`NOT FOUND: dataset with id ${t.Dataset_ID}`, t);
          return null
        }
      });
    return item;
  })
}

module.exports = async (req, res) => {
  log.trace("requesting news");

  const list = await datasetShortNamesFullList.cachedFetch ();

  if (!list || list.length === 0) {
    log.error("error requesting dataset names for news tags", { error: err });
    return res.status(500).send("Error retrieving news");
  }

  let pool = await pools.userReadAndWritePool;
  let request = new sql.Request(pool);

  let result;
  try {
    result = await request.query(query);
  } catch (e) {
    log.error("error requesting news", { error: e });
    res.status(500).send("Error retrieving news");
    return;
  }

  const finalData = mergeResults (...result.recordsets, list);

  if (result && finalData) {
    res.status(200).json(finalData);
    return;
  }

  log.error("unknown error listing news")
  res.status(500).send("unknown error");
  return;
};
