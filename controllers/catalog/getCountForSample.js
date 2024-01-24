const { internalRouter } = require ('../../utility/router/internal-router');
const log = require('../../log-service') ('controllers/data/getCountForSample');
const { safePath } = require('../../utility/objectUtils');
const dateUtils = require ('../../utility/dateUtils');

const getCount = async (variableData) => {
  if (!variableData) {
    return [{ status: 400, message: 'no varibale data'}]
  }
  const { meta, Climatology, Has_Depth } = variableData;
  const { queryType, parameters, metadata } = meta;

  if (queryType !== 'sp') {
    return [{ status: 400, message: 'wrong query type'}]
  }

  const { tableName, dt1, dt2 } = parameters;

  const constraints = [];

  if (Climatology) {
    constraints.push ('month = 1');
  } else {
    if (parameters.secondaryField === 'hour'){
      const date1 = dateUtils.toDateString (dt1);
      const date2 = dateUtils.toDateString (dt2);
      constraints.push (`time BETWEEN '${date1}' and '${date2}' AND hour = 12`);
    } else {
      constraints.push(`time BETWEEN '${dt1}' AND '${dt2}'`);
    }
  }

  if (Has_Depth) {
    const [depth1, depth2] = metadata.targetDepthRange;
    constraints.push(`depth BETWEEN ${depth1} AND ${depth2}`);
  }

  const query = `SELECT count (lat) as latCount from ${tableName}
                 WHERE ${constraints.join(' AND ')}`;

  log.debug ('begin sample count query', { query });
  const [error, result] = await internalRouter (query);

  if (error) {
    console.log(error);
    return [{ status: 500, message: 'error determining count', err: error }];
  }

  // result could be from SqlServer or Cluster
  const normalizedResultArray = result.recordset ? result.recordset : result;
  const count = safePath (['0', 'latCount']) (normalizedResultArray);

  console.log ('COUNT RESULT', count, result);

  if (Number.isInteger (count)) {
    return [false, count];
  } else {
    console.log ('COUNT RESULT', count, result);

    return [{status: 500, message: 'unable to determine query size (lat count)'}]
  }
}

module.exports = getCount;
