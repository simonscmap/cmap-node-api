const SERVER_NAMES = Object.freeze({
  "mariana": "mariana",
  "rossby": "rossby",
  "rainier": "rainier",
});

const CLUSTER_CHUNK_MAX_ROWS = 1000;

const COMMAND_TYPES = {
  sproc: 'sproc',
  custom: 'custom',
}

module.exports = {
  SERVER_NAMES,
  CMAP_DATA_SUBMISSION_EMAIL_ADDRESS: 'cmap-data-submission@uw.edu',
  CLUSTER_CHUNK_MAX_ROWS,
  COMMAND_TYPES,
};
