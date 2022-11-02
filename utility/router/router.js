const initializeLogger = require("../../log-service");
const log = initializeLogger("utility/router/router");
const { getCandidateList } = require("./queryToDatabaseTarget");

const { executeQueryOnCluster } = require("../queryHandler/queryCluster");
const { executeQueryOnPrem } = require("../queryHandler/queryOnPrem");

const routeQuery = async (req, res, next, query) => {
  if (typeof query !== "string") {
    log.warn("no query", { query, originalUrl: req.originalUrl });
    res.status(400).send("missing query");
  }

  // 0. fetch candidate list
  let {
    commandType,
    priorityTargetType,
    candidateLocations,
  } = await getCandidateList(query);

  const queryIsExecutingSproc = commandType === "sproc";

  if (
    !Array.isArray(candidateLocations) ||
    (candidateLocations.length === 0 && !queryIsExecutingSproc)
  ) {
    log.error("no candidate servers identified", { candidateLocations, query });
    res.status(400).send(`no candidate servers available for the given query`);
    return;
  }

  if (candidateLocations.length === 0 && queryIsExecutingSproc) {
    log.trace("contituing with sproc execution without any table specified");
  }

  const targetIsCluster = priorityTargetType === "cluster";

  if (targetIsCluster) {
    executeQueryOnCluster(req, res, next, query);
  } else {
    executeQueryOnPrem(req, res, next, query, candidateLocations);
  }
};


module.exports = { routeQuery };
