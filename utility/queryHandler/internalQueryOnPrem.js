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
  let { pool, selectedServerName, hasError, remainingCandidates } =
    await getPool(candidateList);

  if (hasError) {
    log.error('getPool failed', {
      candidateList,
      remainingCandidates,
    });
    return [hasError, null, remainingCandidates];
  }

  log.info(`remaining candidates: ${remainingCandidates.join(' ')}`);

  // 2. create request object

  log.trace('creating request', { selectedServerName, pool });

  let request;
  try {
    request = await new sql.Request(pool);
  } catch (e) {
    log.error(
      `unable to create new sql request from server pool ${selectedServerName}`,
      {
        error: e,
      },
    );
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
