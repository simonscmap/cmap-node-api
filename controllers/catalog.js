const handleCustomQuery = require('../dbHandlers/handleCustomQuery');    

function catalogQuery() {
    let query = "SELECT RTRIM(LTRIM(Short_Name)) AS variable, ";
    query += "RTRIM(LTRIM(Long_Name)) AS [longName], ";
    query += "RTRIM(LTRIM(Unit)) AS unit, ";
    query += "RTRIM(LTRIM(Make)) AS make, ";
    query += "RTRIM(LTRIM(Sensor)) AS sensor, ";
    query += "RTRIM(LTRIM(Process_Stage_Long)) AS [processLevel], ";
    query += "RTRIM(LTRIM(Study_Domain)) AS [studyDomain], "
    query += "RTRIM(LTRIM(Temporal_Resolution)) AS [temporalResolution], ";
    query += "RTRIM(LTRIM(Spatial_Resolution)) AS [spatialResolution], ";
    query += "RTRIM(LTRIM(Comment)) AS [comment], ";
    query += "RTRIM(LTRIM(Dataset_Long_Name)) AS [datasetName], ";
    query += "RTRIM(LTRIM(Data_Source)) AS [dataSource], ";
    query += "RTRIM(LTRIM(Distributor)) AS [distributor], ";
    query += "RTRIM(LTRIM(Description)) AS [datasetDescription], ";
    query += "[tblVariables].Dataset_ID AS [datasetID], ";
    query += "[tblVariables].ID AS [id], ";
    query += "[tblVariables].Table_Name AS [tableName], ";
    query += "[keywords_agg].Keywords AS [keywords] ";
    query += "FROM tblVariables ";
    query += "JOIN tblDatasets ON [tblVariables].Dataset_ID=[tblDatasets].ID ";
    query += "JOIN tblTemporal_Resolutions ON [tblVariables].Temporal_Res_ID=[tblTemporal_Resolutions].ID ";
    query += "JOIN tblSpatial_Resolutions ON [tblVariables].Spatial_Res_ID=[tblSpatial_Resolutions].ID ";
    query += "JOIN tblMakes ON [tblVariables].Make_ID=[tblMakes].ID ";
    query += "JOIN tblSensors ON [tblVariables].Sensor_ID=[tblSensors].ID ";
    query += "JOIN tblProcess_Stages ON [tblVariables].Process_ID=[tblProcess_Stages].ID ";
    query += "JOIN tblStudy_Domains ON [tblVariables].Study_Domain_ID=[tblStudy_Domains].ID ";
    query += "JOIN (SELECT var_ID, STRING_AGG (keywords, ', ') AS Keywords FROM tblVariables var_table ";
    query += "JOIN tblKeywords key_table ON [var_table].ID = [key_table].var_ID GROUP BY var_ID) ";
    query += "AS keywords_agg ON [keywords_agg].var_ID = [tblVariables].ID";
    return query;
}
// function catalogQuery() {
//     // Build the query which will return the variable catalog. This will be replaced with a sproc later.
//     let query = "";    
//     query += "SELECT RTRIM(LTRIM(Short_Name)) AS variable, ";
//     query += "RTRIM(LTRIM(Long_Name)) AS [longName], ";
//     query += "RTRIM(LTRIM(Unit)) AS unit, ";
//     query += "RTRIM(LTRIM(Make)) AS make, ";
//     query += "RTRIM(LTRIM(Sensor)) AS sensor, ";
//     query += "RTRIM(LTRIM(Process_Stage_Long)) AS [processLevel], ";
//     query += "RTRIM(LTRIM(Study_Domain)) AS [studyDomain], ";
//     query += "RTRIM(LTRIM(Temporal_Resolution)) AS [temporalResolution], ";
//     query += "RTRIM(LTRIM(Spatial_Resolution)) AS [spatialResolution], ";
//     query += "RTRIM(LTRIM(Comment)) AS [comment], ";

//     query += "RTRIM(LTRIM(Dataset_Long_Name)) AS [datasetName], ";
//     query += "RTRIM(LTRIM(Data_Source)) AS [dataSource], ";
//     query += "RTRIM(LTRIM(Distributor)) AS [distributor], ";
//     query += "RTRIM(LTRIM(Description)) AS [datasetDescription], ";
//     query += "[tblVariables].Dataset_ID AS [datasetID], ";
//     query += "[tblVariables].ID AS [id], ";
//     query += "[tblVariables].Table_Name AS [tableName], ";
//     query += "[tblVariables].Keywords AS [keywords] ";
    
//     query += "FROM tblVariables ";
//     query += "JOIN tblDatasets ON [tblVariables].Dataset_ID=[tblDatasets].ID ";
//     query += "JOIN tblTemporal_Resolutions ON [tblVariables].Temporal_Res_ID=[tblTemporal_Resolutions].ID ";
//     query += "JOIN tblSpatial_Resolutions ON [tblVariables].Spatial_Res_ID=[tblSpatial_Resolutions].ID ";
//     query += "JOIN tblMakes ON [tblVariables].Make_ID=[tblMakes].ID ";
//     query += "JOIN tblSensors ON [tblVariables].Sensor_ID=[tblSensors].ID ";
//     query += "JOIN tblProcess_Stages ON [tblVariables].Process_ID=[tblProcess_Stages].ID ";
//     query += "JOIN tblStudy_Domains ON [tblVariables].Study_Domain_ID=[tblStudy_Domains].ID ";
//     return query;
// };


exports.retrieve = async (req, res, next)=>{
    // Retrieve the variable catalog from the db and return it as json.
    // await handleCustomQuery('SELECT * FROM dbo.udfCatalog()', res, next);
    let query = catalogQuery();
    await handleCustomQuery(query, res, next);
    next();
};