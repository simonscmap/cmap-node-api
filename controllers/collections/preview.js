const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const initializeLogger = require('../../log-service');

const log = initializeLogger('controllers/collections/preview');

module.exports = async (req, res) => {
  const { datasets, collectionId } = req.validatedQuery;

  log.info('fetching dataset preview metadata', {
    datasetCount: datasets.length,
    datasetsRequested: datasets,
  });

  try {
    const pool = await pools.userReadAndWritePool;
    const request = new sql.Request(pool);

    // Create a CTE (Common Table Expression) with requested datasets
    // Build a VALUES clause with all requested dataset names
    const valuesClause = datasets
      .map((_, index) => {
        request.input('shortName' + index, sql.NVarChar, datasets[index]);
        return `(@shortName${index})`;
      })
      .join(', ');

    const query = `
      WITH RequestedDatasets AS (
        SELECT shortName
        FROM (VALUES ${valuesClause}) AS v(shortName)
      )
      SELECT
        requested.shortName as shortName,
        ds.Dataset_Long_Name as longName,
        ds.Description as description,
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
            THEN 1 ELSE 0 END as hasAncillaryData,
        CASE WHEN ds.Dataset_Name IS NULL THEN 1 ELSE 0 END as isInvalid
      FROM RequestedDatasets requested
      LEFT JOIN tblDatasets ds ON requested.shortName = ds.Dataset_Name
      LEFT JOIN tblDataset_Stats stats ON ds.ID = stats.Dataset_ID
      LEFT JOIN tblVariables v ON ds.ID = v.Dataset_ID
      LEFT JOIN tblSensors s ON v.Sensor_ID = s.ID
      LEFT JOIN tblMakes m ON v.Make_ID = m.ID
      GROUP BY requested.shortName, ds.ID, ds.Dataset_Name, ds.Dataset_Long_Name, ds.Description, stats.JSON_stats, v.Table_Name
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

      const isInvalid = row.isInvalid === 1;

      return {
        shortName: row.shortName,
        longName: row.longName || null,
        description: row.description || null,
        timeStart: row.timeStart || null,
        timeEnd: row.timeEnd || null,
        rowCount: row.Row_Count || null,
        sensors: deduplicateList(row.sensors),
        makes: deduplicateList(row.makes),
        regions: deduplicateList(row.regions),
        isContinuouslyUpdated: row.isContinuouslyUpdated === 1,
        hasAncillaryData: row.hasAncillaryData === 1,
        isInvalid: isInvalid,
      };
    });

    // Identify invalid datasets for logging
    const invalidDatasets = processedResults.filter((r) => r.isInvalid);

    if (invalidDatasets.length > 0) {
      log.warn('invalid datasets requested in preview', {
        invalidDatasets: invalidDatasets.map((d) => d.shortName),
        invalidCount: invalidDatasets.length,
        collectionId,
      });
    }

    log.info('dataset preview metadata retrieved successfully', {
      datasetsFound: processedResults.length,
      datasetsRequested: datasets.length,
      validDatasets: processedResults.length - invalidDatasets.length,
      invalidDatasets: invalidDatasets.length,
      collectionId,
    });

    // Send response immediately
    res.status(200).json(processedResults);

    // Fire-and-forget: increment views count if collection_id is provided
    if (collectionId) {
      (async () => {
        try {
          const updateRequest = new sql.Request(pool);
          updateRequest.input('collectionId', sql.Int, collectionId);

          await updateRequest.query(`
            UPDATE dbo.tblCollections
            SET Views = ISNULL(Views, 0) + 1
            WHERE Collection_ID = @collectionId
          `);

          log.info('collection views count incremented', {
            collectionId: collectionId,
          });
        } catch (updateError) {
          // Log error but don't fail the request
          log.error('failed to increment collection views count', {
            collectionId: collectionId,
            error: updateError.message,
          });
        }
      })();
    }
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
