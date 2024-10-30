// Takes a dataset-like object and reports whether it is gridded data or not
const logInit = require("../../log-service");

const moduleLogger = logInit ('calculateQuerySize');


function isGriddedData (dataset = {}) {
  moduleLogger.debug ('determining if dataset is gridded', dataset);

  let { Temporal_Resolution, Spatial_Resolution } = dataset;
  if (typeof Temporal_Resolution !== 'string' || typeof Spatial_Resolution !== 'string' ) {
    //
    moduleLogger.warn ('cannot determine if dataset is gridded', { Temporal_Resolution, Spatial_Resolution });
  }

  if (Temporal_Resolution === "Irregular" || Spatial_Resolution === "Irregular") {
    return false;
  }

  return true;
}

module.exports = isGriddedData;
