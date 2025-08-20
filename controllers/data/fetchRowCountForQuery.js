const { internalRouter } = require('../../utility/router/internal-router');
const generateQueryFromConstraints = require('./generateQueryFromConstraints');
const initLog = require('../../log-service');
const moduleLogger = initLog('getRowCountForQuery');
// Make routed request to get a count of matching rows for a provided query

// getRowCountForQuery :: TableName -> Constraints -> Dataset -> Request Id -> [ Error?, Result ]
const getRowCountForQuery = async (
  tablename,
  constraints,
  dataset,
  requestId,
) => {
  const log = moduleLogger.setReqId('mlep');
  let query = generateQueryFromConstraints(
    tablename,
    constraints,
    dataset,
    'count',
  );

  let [queryError, countResult] = await internalRouter(query, requestId);
  log.info('queryError: ', queryError);
  log.info('countResult: ', countResult);
  log.info('recordset: ', countResult.recordset);
  log.info('recordsetS: ', countResult.recordsets[0]);
  if (queryError) {
    return [queryError];
  }

  // cluster result
  if (
    Array.isArray(countResult) &&
    countResult.length === 1 &&
    Object.prototype.hasOwnProperty.call(countResult[0], 'c')
  ) {
    return [null, countResult[0].c];
  }

  // on prem result
  if (
    typeof countResult === 'object' &&
    Array.isArray(countResult.recordset) &&
    countResult.recordset.length &&
    Object.prototype.hasOwnProperty.call(countResult.recordset[0], 'c')
  ) {
    return [null, countResult.recordset[0].c];
  }

  // unexpected condition
  return ['unexpected result; unable to get row count'];
};

module.exports = getRowCountForQuery;
