// process the data: create a map of data features, keyed by table name
// { tblName: { ci: true, ancillary: undefined }}
// the `undefined` value allows the serialized json to be smaller, because it omits
// any keys that point to `undefined`
const transformFeatureResults = (recordsets, log) => {
  if (!log) {
    console.error ('a log function is required');
    return null;
  }
  if (!Array.isArray(recordsets) || !recordsets.every(Array.isArray) || recordsets.length !== 2) {
    log.error('expected array for recordsets', { recordsets });
    return null;
  }

  let [ ancillary, ci] = recordsets;

  ancillary = ancillary.reduce((accumulator, current) => {
    let { Table_Name } = current; // note the case
    let key = Table_Name.toLowerCase().trim();
    accumulator[key] = { ancillary: true };
    return accumulator;
  }, {});

  ci = ci.reduce((accumulator, current) => {
    let { table_name } = current; // note the key has different case
    let key = table_name.toLowerCase().trim();
    accumulator[key] = { ci: true };
    return accumulator;
  }, {});

  let mergeFlagsForTableName = (tableName) => ({
    [tableName]: Object.assign({}, ancillary[tableName], ci[tableName])
  });

  let tables = Array.from(
    new Set(
      Object.keys(ancillary).concat(Object.keys(ci))
    )
  )
                    .map(mergeFlagsForTableName)
                    .reduce((acc, curr) => ({...acc, ...curr}), {});

  return tables;
}

module.exports = { transformFeatureResults };
