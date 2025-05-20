const sql = require('mssql');
const initializeLogger = require('../../log-service');
const { getPool } = require('./getPool');
const moduleLogger = initializeLogger('router/intenalQueryOnPrem');

const executeQueryOnPrem = async (query, candidateList = [], requestId) => {
  const log = moduleLogger
    .setReqId(requestId)
    .addContext(['candidates', candidateList])
    .addContext(['query', query]);

  // 1. determine pool
  let { pool, poolName, error, remainingCandidates } = await getPool(
    candidateList,
  );

  if (error) {
    log.error('getPool failed', {
      candidateList,
      remainingCandidates,
    });
    return [error, null, remainingCandidates];
  }

  log.info(`remaining candidates: ${remainingCandidates.join(' ')}`);

  // 2. create request object

  log.trace('creating request', { poolName, pool });

  let request;
  try {
    request = await new sql.Request(pool);
  } catch (e) {
    log.error(`unable to create new sql request from pool ${poolName}`, {
      error: e,
    });
    return [e, null, remainingCandidates];
  }

  // 3. execute
  try {
    let result = await request.query(query);
    return [null, result, remainingCandidates];
  } catch (e) {
    return [e, null, remainingCandidates];
  }
};

module.exports = executeQueryOnPrem;
