const test = require('ava');
const {
  transformDatasetServersListToMap,
} = require('../../utility/router/pure');

test('produces expected Map object', (t) => {
  let recordset = [
    { Dataset_ID: 1, Server_Alias: 'rossby' },
    { Dataset_ID: 8, Server_Alias: 'mariana' },
    { Dataset_ID: 8, Server_Alias: 'ranier' },
    { Dataset_ID: 8, Server_Alias: 'rossby' },
  ];

  let r = transformDatasetServersListToMap(recordset);

  // key with one server target
  t.is(r.get(1).length, 1);
  t.deepEqual(r.get(1), ['rossby']);

  // key with no info
  t.is(r.get(0), undefined);

  // check values stored in Map under the key 8
  let mg8 = r.get(8);
  t.is(mg8.length, 3);
  t.truthy(['rossby', 'ranier', 'mariana'].every((n) => mg8.includes(n)));
});
