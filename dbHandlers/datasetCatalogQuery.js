module.exports = `
    SELECT
    'Dataset' as Product_Type,
    ds.Dataset_Name as Short_Name,
    RTRIM(LTRIM(ds.Dataset_Long_Name)) AS [Long_Name],
    ds.Description,
    ds.Icon_URL,
    ds.Dataset_Release_Date,
    ds.Dataset_History,
    ds.Dataset_Version,
    cat.Table_Name,
    cat.Process_Level,
    cat.Make,
    cat.Data_Source,
    cat.Distributor,
    cat.Acknowledgement,
    cat.Dataset_ID,
    cat.Spatial_Resolution,
    cat.Temporal_Resolution,
    cat.Study_Domain,
    aggs.Lat_Min,
    aggs.Lat_Max,
    aggs.Lon_Min,
    aggs.Lon_Max,
    aggs.Depth_Min,
    aggs.Depth_Max,
    aggs.Time_Min,
    aggs.Time_Max,
    aggs.Sensors,    
    aggs.Visualize,
    aggs.Row_Count,
    regs.Regions,
    refs.[References]

    FROM (
        SELECT
            [tblVariables].ID,
            [tblVariables].Table_Name AS [Table_Name],
            RTRIM(LTRIM(Long_Name)) AS [Long_Name],
            RTRIM(LTRIM(Make)) AS [Make],
            RTRIM(LTRIM(Process_Stage_Long)) AS [Process_Level],
            RTRIM(LTRIM(Study_Domain)) AS [Study_Domain],
            RTRIM(LTRIM(Temporal_Resolution)) AS [Temporal_Resolution],
            RTRIM(LTRIM(Spatial_Resolution)) AS [Spatial_Resolution],
            RTRIM(LTRIM([Data_Source])) AS [Data_Source],
            RTRIM(LTRIM(Distributor)) AS [Distributor],
            RTRIM(LTRIM([Description])) AS [Dataset_Description],
            RTRIM(LTRIM([Acknowledgement])) AS [Acknowledgement],
            [tblVariables].Dataset_ID AS [Dataset_ID]
            FROM [dbo].[tblVariables]
            JOIN [dbo].[tblDatasets] ON [tblVariables].Dataset_ID=[tblDatasets].ID
            JOIN [dbo].[tblTemporal_Resolutions] ON [tblVariables].Temporal_Res_ID=[tblTemporal_Resolutions].ID
            JOIN [dbo].[tblSpatial_Resolutions] ON [tblVariables].Spatial_Res_ID=[tblSpatial_Resolutions].ID
            JOIN [dbo].[tblMakes] ON [tblVariables].Make_ID=[tblMakes].ID
            JOIN [dbo].[tblProcess_Stages] ON [tblVariables].Process_ID=[tblProcess_Stages].ID
            JOIN [dbo].[tblStudy_Domains] ON [tblVariables].Study_Domain_ID=[tblStudy_Domains].ID
    ) cat

    JOIN tblDatasets as ds
    on ds.ID = cat.Dataset_ID

    JOIN (
        SELECT
        MIN(Lat_Min) as Lat_Min,
        MAX(Lat_Max) as Lat_Max,
        MIN(Lon_Min) as Lon_Min,
        MAX(Lon_Max) as Lon_Max,
        Min(Depth_Min) as Depth_Min,
        MAX(Depth_Max) as Depth_Max,
        MIN(Time_Min) as Time_Min,
        MAX(Time_Max) as Time_Max,
        MAX(Row_Count) as Row_Count,
        STRING_AGG(CAST(Long_Name AS nvarchar(MAX)), ',') as Variable_Long_Names,
        STRING_AGG(CAST(Short_Name AS nvarchar(MAX)), ',') as Variable_Short_Names,
        STRING_AGG(CAST(Keywords AS nvarchar(MAX)), ',') as Keywords,
        STRING_AGG(CAST(Sensor AS nvarchar(MAX)), ',') as Sensors,
        MAX(CAST(Visualize as [int])) as Visualize,
        Dataset_ID
        FROM (
            SELECT
            Long_Name,
            JSON_VALUE(JSON_stats,'$.time.min') AS [Time_Min],
            JSON_VALUE(JSON_stats,'$.time.max') AS [Time_Max],
            CAST(JSON_VALUE(JSON_stats,'$.lat.count') AS float) AS [Row_Count],
            CAST(JSON_VALUE(JSON_stats,'$.lat.min') AS float) AS [Lat_Min],
            CAST(JSON_VALUE(JSON_stats,'$.lat.max') AS float) AS [Lat_Max],
            CAST(JSON_VALUE(JSON_stats,'$.lon.min') AS float) AS [Lon_Min],
            CAST(JSON_VALUE(JSON_stats,'$.lon.max') AS float) AS [Lon_Max],
            CAST(JSON_VALUE(JSON_stats,'$.depth.min') AS float) AS [Depth_Min],
            CAST(JSON_VALUE(JSON_stats,'$.depth.max') AS float) AS [Depth_Max],
            RTRIM(LTRIM(Sensor)) AS [Sensor],
            [tblVariables].Visualize,
            [tblVariables].Dataset_ID,
            [tblVariables].Short_Name,
            [keywords_agg].Keywords AS [Keywords]
            FROM tblVariables
            JOIN tblDataset_Stats ON [tblVariables].Dataset_ID = [tblDataset_Stats].Dataset_ID
            JOIN tblSensors ON [tblVariables].Sensor_ID=[tblSensors].ID
            JOIN (SELECT var_ID, STRING_AGG (CAST(keywords AS NVARCHAR(MAX)), ', ') AS Keywords FROM tblVariables var_table
            JOIN tblKeywords key_table ON [var_table].ID = [key_table].var_ID GROUP BY var_ID)
            AS keywords_agg ON [keywords_agg].var_ID = [tblVariables].ID
        ) addit
        GROUP BY Dataset_ID
    ) as aggs
    ON aggs.Dataset_ID = cat.Dataset_ID

    LEFT OUTER JOIN (
        SELECT
        Dataset_ID,
        STRING_AGG(CAST(Reference AS nvarchar(MAX)), '$$$') as [References]
        FROM tblDataset_References
        GROUP BY Dataset_ID
    ) as refs
    on ds.ID = refs.Dataset_ID

    LEFT OUTER JOIN (
        SELECT
        ds_reg.Dataset_ID,
        STRING_AGG(CAST(reg.Region_Name AS nvarchar(MAX)), ',') as Regions
        FROM tblDataset_Regions ds_reg
        JOIN tblRegions reg
        ON ds_reg.Region_ID = reg.Region_ID
        GROUP BY ds_reg.Dataset_ID
    ) as regs
    on ds.ID = regs.Dataset_ID

    WHERE cat.ID in (
        SELECT
        MAX(ID) from [dbo].[tblVariables]
        GROUP BY Dataset_ID
    )
`;
