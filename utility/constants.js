const SERVER_NAMES = Object.freeze({
  "mariana": "mariana",
  "rossby": "rossby",
  "rainier": "rainier",
});

const CLUSTER_CHUNK_MAX_ROWS = 100000;

const COMMAND_TYPES = {
  sproc: 'sproc',
  custom: 'custom',
}

const QUERY_ROW_LIMIT = 2000000;

module.exports = {
  SERVER_NAMES,
  CMAP_DATA_SUBMISSION_EMAIL_ADDRESS: 'cmap-data-submission@uw.edu',
  CLUSTER_CHUNK_MAX_ROWS,
  COMMAND_TYPES,
  QUERY_ROW_LIMIT,
};
