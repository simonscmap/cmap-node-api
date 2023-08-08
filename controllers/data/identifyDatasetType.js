// Takes a dataset-like object and reports whether it is gridded data or not
function isGriddedData (dataset = {}) {
  let { Temporal_Resolution, Spatial_Resolution } = dataset;
  if (typeof Temporal_Resolution !== 'string' || typeof Spatial_Resolution !== 'string' ) {
    //
  }
  if (Temporal_Resolution === "Irregular" || Spatial_Resolution === "Irregular") {
    return false;
  }
  return true;
}

module.exports = isGriddedData;
