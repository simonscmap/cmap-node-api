const { internalRouter } = require('../../utility/router/internal-router');
const generateQueryFromConstraints = require('./generateQueryFromConstraints');

// Make routed request to get a count of matching rows for a provided query

// getRowCountForQuery :: TableName -> Constraints -> Dataset -> Request Id -> [ Error?, Result ]
const getRowCountForQuery = async (
  tablename,
  constraints,
  dataset,
  requestId,
) => {
  let query = generateQueryFromConstraints(tablename, constraints, dataset, 'count');

  let [queryError, countResult] = await internalRouter(query, requestId);

  if (queryError) {
    return [queryError];
  }

  // cluster result
  if (
    Array.isArray(countResult) &&
    countResult.length === 1 &&
    countResult[0].c
  ) {
    return [null, countResult[0].c];
  }

  // on prem result
  if (
    typeof countResult === 'object' &&
    Array.isArray(countResult.recordset) &&
    countResult.recordset.length &&
    countResult.recordset[0].c
  ) {
    return [null, countResult.recordset[0].c];
  }

  // unexpected condition
  return ['unexpected result; unable to get row count'];
};

module.exports = getRowCountForQuery;
