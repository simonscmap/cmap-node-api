const sql = require('mssql');
const initializeLogger = require('../../log-service');
const { getPool } = require('./getPool');
const moduleLogger = initializeLogger('router/intenalQueryOnPrem');

// Default query timeout: 60 seconds (in milliseconds)
const DEFAULT_QUERY_TIMEOUT = 60000;
const QUERY_TIMEOUT = parseInt(process.env.INTERNAL_QUERY_TIMEOUT, 10) || DEFAULT_QUERY_TIMEOUT;

const executeQueryOnPrem = async (query, candidateList = [], requestId, options = {}) => {
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

  // Use timeout from options, or fall back to environment/default
  const timeout = options.timeout || QUERY_TIMEOUT;

  let request;
  try {
    request = await new sql.Request(pool);
    request.timeout = timeout;
    log.trace('request timeout set', { timeout });
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
    // Check if this is a timeout error
    if (e.code === 'ETIMEOUT' || (e.message && e.message.includes('timeout'))) {
      log.warn('query timed out', {
        timeout,
        selectedServerName,
        error: e.message,
      });
    }
    return [e, null, remainingCandidates];
  }
};

module.exports = executeQueryOnPrem;
