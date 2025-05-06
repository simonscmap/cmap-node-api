const XLSX = require('xlsx');
const fs = require('fs');
const { Readable } = require('stream');
const initLog = require('../../../log-service');
const moduleLogger = initLog('bulk-download');

const datasetMetadataToDownloadFormat = (metadata) => {
  let { dataset, cruises, references, variables } = metadata;
  let datasetRows = [];

  datasetRows.push({
    dataset_short_name: dataset.Short_Name,
    dataset_long_name: dataset.Long_Name,
    dataset_version: dataset.Dataset_Version || '',
    dataset_release_date: dataset.Dataset_Release_Date || '',
    dataset_make: variables[0].Make,
    dataset_source: dataset.Data_Source || '',
    dataset_distributor: dataset.Distributor || '',
    dataset_acknowledgement: dataset.Acknowledgement || '',
    dataset_history: dataset.Dataset_History || '',
    dataset_description: dataset.Description || '',
    dataset_references: references[0] || '',
    climatology: dataset.Climatology || 0,
    cruise_names: cruises[0] ? cruises[0].Name : '',
    dataset_unstructured_metadata: dataset.Unstructured_Dataset_Metadata || '',
  });

  cruises.forEach((e, i) => {
    if (i > 0) {
      datasetRows.push({ cruise_names: e.Name });
    }
  });

  references.forEach((e, i) => {
    if (i > 0) {
      if (datasetRows[i]) {
        datasetRows[i].dataset_references = e;
      } else {
        datasetRows.push({ dataset_references: e });
      }
    }
  });

  let variableRows = [];
  let summaryStatisticsRows = [];

  variables.forEach((e) => {
    variableRows.push({
      var_short_name: e.Variable,
      var_long_name: e.Long_Name,
      var_sensor: e.Sensor,
      var_unit: e.Unit || '',
      var_spatial_res: e.Spatial_Resolution,
      var_temporal_res: e.Temporal_Resolution,
      var_discipline: e.Study_Domain,
      visualize: e.Visualize ? 1 : 0,
      var_keywords: e.Keywords || '',
      var_comment: e.Comment || '',
      var_unstructured_variable_metadata:
        e.Unstructured_Variable_Metadata || '',
    });

    summaryStatisticsRows.push({
      Variable: e.Long_Name,
      Time_Min: e.Time_Min || 'NA',
      Time_Max: e.Time_Max || 'NA',
      Lat_Min: e.Lat_Min || 'NA',
      Lat_Max: e.Lat_Max || 'NA',
      Lon_Min: e.Lon_Min || 'NA',
      Lon_Max: e.Lon_Max || 'NA',
      Variable_Mean: e.Variable_Mean || 'NA',
      Variable_STD: e.Variable_STD || 'NA',
      Variable_Min: e.Variable_Min || 'NA',
      Variable_Max: e.Variable_Max || 'NA',
      Variable_25th: e.Variable_25th || 'NA',
      Variable_50th: e.Variable_50th || 'NA',
      Variable_75th: e.Variable_75th || 'NA',
    });
  });

  return {
    datasetRows,
    variableRows,
    summaryStatisticsRows,
  };
};

const makeMetadataWorkbook = (metadataJSON) => {
  let fullPageData = datasetMetadataToDownloadFormat(metadataJSON);
  let workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(fullPageData.datasetRows),
    'Dataset Metadata',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(fullPageData.variableRows),
    'Variable Metadata',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(fullPageData.summaryStatisticsRows),
    'Variable Summary Statistics',
  );

  let buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  });

  return buffer;
};

const writeToDisk = (buffer, targetPath) => {
  return new Promise((resolve, reject) => {
    const targetFile = fs.createWriteStream(targetPath, { close: true });
    const stream = Readable.from(buffer);

    targetFile.on('end', (d) => {
      moduleLogger.info('file stream end', { d });
    });

    targetFile.on('close', (d) => {
      moduleLogger.info('target file stream closed', d);
      resolve();
    });

    targetFile.on('error', (e) => {
      moduleLogger.error('write error', e);
      reject();
    });

    stream.pipe(targetFile);
  });
};

module.exports = {
  assemble: datasetMetadataToDownloadFormat,
  toBuffer: makeMetadataWorkbook,
  toDisk: writeToDisk,
};
