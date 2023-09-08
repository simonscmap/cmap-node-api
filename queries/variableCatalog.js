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
