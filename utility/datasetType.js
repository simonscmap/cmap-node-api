/**
 * Determine dataset type based on makes and sensors
 * @param {Array<string>} makes - Array of make values (e.g., ["Model"], ["Observation"])
 * @param {Array<string>} sensors - Array of sensor values (e.g., ["Satellite"], ["Ship"])
 * @returns {string} Dataset type: "Model", "Satellite", or "In-Situ"
 */
const getDatasetType = (makes = [], sensors = []) => {
  // Convert arrays to lowercase for case-insensitive comparison
  const makesLower = makes.map((make) => make.toLowerCase());
  const sensorsLower = sensors.map((sensor) => sensor.toLowerCase());

  // Make: Model -> Type: Model
  if (makesLower.includes('model')) {
    return 'Model';
  }

  // Make: Observation + Sensor: Satellite -> Type: Satellite
  if (
    makesLower.includes('observation') &&
    sensorsLower.includes('satellite')
  ) {
    return 'Satellite';
  }

  // Else, Type: In-Situ
  return 'In-Situ';
};

module.exports = {
  getDatasetType,
};
