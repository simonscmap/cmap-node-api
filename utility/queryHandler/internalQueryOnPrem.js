const sql = require("mssql");
const initializeLogger = require("../../log-service");
const { logErrors, logMessages } = require('../../log-service/log-helpers');
const { getPool } = require("./getPool");
const moduleLogger = initializeLogger("router/intenalQueryOnPrem");

const executeQueryOnPrem = async (query, candidateList = [], requestId) => {
  const log = moduleLogger
    .setReqId(requestId)
    .addContext(['candidates', candidateList])
    .addContext(['query', query ]);

  // 1. determine pool
  let { pool, poolName, error, errors, messages, remainingCandidates } =
    await getPool (candidateList);

  if (error) {
    logErrors (log) (errors);
    logMessages (log) (messages);
    return remainingCandidates;
  }

  logMessages (log) (messages);

  log.info (`remaining candidates: ${remainingCandidates.join (' ')}`);

  // 2. create request object

  log.trace ("making request", { poolName });

  let request = await new sql.Request (pool);

  // 3. execute
  try {
    let result = await request.query(query);
    console.log ('on prem result', result);
    return [null, result, remainingCandidates];
  } catch (e) {
    return [e, null, remainingCandidates];
  }
};

module.exports = executeQueryOnPrem;
