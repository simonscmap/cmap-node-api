module.exports.variableCatalog = `WITH ct1 AS(
  SELECT st.Dataset_ID, ca.*
  FROM tblDataset_Stats_geo st
  CROSS APPLY OPENJSON(st.JSON_stats) ca
)

SELECT
    RTRIM(LTRIM(Short_Name)) AS Variable,
    [tblVariables].Table_Name AS [Table_Name],
    RTRIM(LTRIM(Long_Name)) AS [Long_Name],
    RTRIM(LTRIM(Unit)) AS [Unit],
    RTRIM(LTRIM(Make)) AS [Make],
    RTRIM(LTRIM(Sensor)) AS [Sensor],
    RTRIM(LTRIM(Process_Stage_Long)) AS [Process_Level],
    RTRIM(LTRIM(Study_Domain)) AS [Study_Domain],
    RTRIM(LTRIM(Temporal_Resolution)) AS [Temporal_Resolution],
    RTRIM(LTRIM(Spatial_Resolution)) AS [Spatial_Resolution],

--- Dataset stats also needed
    --JSON_VALUE(JSON_stats,'$.time.min') AS [Time_Min],
    --JSON_VALUE(JSON_stats,'$.time.max') AS [Time_Max],
    --CAST(JSON_VALUE(JSON_stats,'$.lat.count') AS float) AS [Row_Count],
    --CAST(JSON_VALUE(JSON_stats,'$.lat.min') AS float) AS [Lat_Min],
    --CAST(JSON_VALUE(JSON_stats,'$.lat.max') AS float) AS [Lat_Max],
    --CAST(JSON_VALUE(JSON_stats,'$.lon.min') AS float) AS [Lon_Min],
    --CAST(JSON_VALUE(JSON_stats,'$.lon.max') AS float) AS [Lon_Max],
    --CAST(JSON_VALUE(JSON_stats,'$.depth.min') AS float) AS [Depth_Min],
    --CAST(JSON_VALUE(JSON_stats,'$.depth.max') AS float) AS [Depth_Max],

--- Variable stats from cross apply
      [25%] as Variable_25th,
      [50%] as Variable_50th,
      [75%] as Variable_75th,
      [count] as Variable_Count,
      [mean] as  Variable_Mean,
      [std] as  Variable_STD,
      [min] as  Variable_Min,
      [max] as  Variable_Max,

    RTRIM(LTRIM(Comment)) AS [Comment],
    [tblDatasets].ID as [Dataset_ID],
    RTRIM(LTRIM([tblDatasets].Dataset_Name)) as [Dataset_Short_Name],
    RTRIM(LTRIM(Dataset_Long_Name)) AS [Dataset_Name],
    RTRIM(LTRIM([Data_Source])) AS [Data_Source],
    RTRIM(LTRIM(Distributor)) AS [Distributor],
    RTRIM(LTRIM([Description])) AS [Dataset_Description],
    RTRIM(LTRIM([Acknowledgement])) AS [Acknowledgement],
    [tblVariables].Dataset_ID AS [Dataset_ID],
    [tblVariables].ID AS [ID],
    [tblVariables].Visualize AS [Visualize],
    [keywords_agg].Keywords AS [Keywords]
FROM ct1
CROSS APPLY OPENJSON(ct1.value)
WITH (
[25%] FLOAT,
[50%] FLOAT,
[75%] FLOAT,
[count] FLOAT,
[max] NVARCHAR(MAX),
[min] NVARCHAR(MAX),
[mean] FLOAT,
[std] FLOAT
)
JOIN tblDatasets ON ct1.Dataset_ID = tblDatasets.ID
JOIN tblVariables ON [tblVariables].Dataset_ID = ct1.Dataset_ID AND ct1.[key] COLLATE DATABASE_DEFAULT = [tblVariables].Short_Name COLLATE DATABASE_DEFAULT
JOIN tblTemporal_Resolutions ON [tblVariables].Temporal_Res_ID=[tblTemporal_Resolutions].ID
JOIN tblSpatial_Resolutions ON [tblVariables].Spatial_Res_ID=[tblSpatial_Resolutions].ID
JOIN tblMakes ON [tblVariables].Make_ID=[tblMakes].ID
JOIN tblSensors ON [tblVariables].Sensor_ID=[tblSensors].ID
JOIN tblProcess_Stages ON [tblVariables].Process_ID=[tblProcess_Stages].ID
JOIN tblStudy_Domains ON [tblVariables].Study_Domain_ID=[tblStudy_Domains].ID
JOIN (SELECT var_ID, STRING_AGG ( CAST(keywords as NVARCHAR(MAX)), ', ') AS Keywords FROM tblVariables var_table
JOIN tblKeywords key_table ON [var_table].ID = [key_table].var_ID GROUP BY var_ID)
AS keywords_agg ON [keywords_agg].var_ID = [tblVariables].ID
    LEFT JOIN tblDataset_Stats ON [tblVariables].Dataset_ID = [tblDataset_Stats].Dataset_ID`;



module.exports.variableCatalogUnstructuredMetadata = `
SELECT
    RTRIM(LTRIM([tblDatasets].Dataset_Name)) as [Dataset_Short_Name],
    RTRIM(LTRIM(Short_Name)) AS Variable,
    CASE WHEN [Variable_Metadata].Unstructured_Variable_Metadata IS NULL
        THEN NULL
        ELSE '['+[Variable_Metadata].Unstructured_Variable_Metadata+']' END as [Unstructured_Variable_Metadata]
    FROM tblVariables
    JOIN tblDatasets ON [tblVariables].Dataset_ID=[tblDatasets].ID
   LEFT JOIN (SELECT Var_ID, STRING_AGG (CAST(JSON_Metadata as NVARCHAR(MAX)), ', ') AS Unstructured_Variable_Metadata FROM tblVariables var_meta_table
   JOIN tblVariables_JSON_Metadata meta_table ON [var_meta_table].ID = [meta_table].Var_ID GROUP BY Var_ID)
   AS Variable_Metadata ON [Variable_Metadata].Var_ID = [tblVariables].ID`;
