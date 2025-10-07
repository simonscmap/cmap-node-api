const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/preview');

module.exports = async (req, res) => {
  const { datasets } = req.validatedQuery;

  log.info('fetching dataset preview metadata', {
    datasetCount: datasets.length,
    datasetsRequested: datasets,
  });

  try {
    const pool = await pools.userReadAndWritePool;
    const request = new sql.Request(pool);

    // Dynamically add input parameters for each dataset
    datasets.forEach((datasetName, index) => {
      request.input('shortName' + index, sql.NVarChar, datasetName);
    });

    // Build WHERE clause with dynamic parameter names
    const paramNames = datasets
      .map((_, index) => '@shortName' + index)
      .join(', ');

    const query = `
      SELECT
        ds.Dataset_Name as shortName,
        JSON_VALUE(stats.JSON_stats, '$.time.min') as timeStart,
        JSON_VALUE(stats.JSON_stats, '$.time.max') as timeEnd,
        CAST(JSON_VALUE(stats.JSON_stats, '$.lon.count') AS float) AS [Row_Count],
        STRING_AGG(CAST(s.Sensor AS NVARCHAR(MAX)), ',') as sensors,
        STRING_AGG(CAST(m.Make AS NVARCHAR(MAX)), ',') as makes,
        (SELECT STRING_AGG(CAST(r.Region_Name AS NVARCHAR(MAX)), ',')
         FROM tblDataset_Regions dr
         JOIN tblRegions r ON dr.Region_ID = r.Region_ID
         WHERE dr.Dataset_ID = ds.ID
        ) as regions,
        CASE WHEN v.Table_Name IN (SELECT table_name FROM dbo.udfDatasetBadges())
            THEN 1 ELSE 0 END as isContinuouslyUpdated,
        CASE WHEN v.Table_Name IN (SELECT table_name FROM dbo.udfDatasetsWithAncillary())
            THEN 1 ELSE 0 END as hasAncillaryData
      FROM tblDatasets ds
      JOIN tblDataset_Stats stats ON ds.ID = stats.Dataset_ID
      LEFT JOIN tblVariables v ON ds.ID = v.Dataset_ID
      LEFT JOIN tblSensors s ON v.Sensor_ID = s.ID
      LEFT JOIN tblMakes m ON v.Make_ID = m.ID
      WHERE ds.Dataset_Name IN (${paramNames})
      GROUP BY ds.ID, ds.Dataset_Name, stats.JSON_stats, v.Table_Name
    `;

    const result = await request.query(query);

    // Process results: deduplicate sensors, makes, and regions
    const processedResults = result.recordset.map((row) => {
      // Helper function to deduplicate comma-separated strings
      const deduplicateList = (str) => {
        if (!str) {
          return [];
        }
        const items = str
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item);
        return Array.from(new Set(items));
      };

      return {
        shortName: row.shortName,
        timeStart: row.timeStart || null,
        timeEnd: row.timeEnd || null,
        Row_Count: row.Row_Count,
        sensors: deduplicateList(row.sensors),
        makes: deduplicateList(row.makes),
        regions: deduplicateList(row.regions),
        isContinuouslyUpdated: row.isContinuouslyUpdated === 1,
        hasAncillaryData: row.hasAncillaryData === 1,
      };
    });

    log.info('dataset preview metadata retrieved successfully', {
      datasetsFound: processedResults.length,
      datasetsRequested: datasets.length,
    });

    res.status(200).json(processedResults);
  } catch (error) {
    log.error('error fetching dataset preview metadata', {
      error: error.message,
      datasetsRequested: datasets,
    });
    res.status(500).json({
      error: 'server_error',
      message: 'Error fetching dataset preview metadata',
    });
  }
};
