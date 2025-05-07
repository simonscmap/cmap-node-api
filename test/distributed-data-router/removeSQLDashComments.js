const test = require('ava');
const { removeSQLDashComments } = require('../../utility/router/pure');

test("correctly removes a '--' comment from query string", (t) => {
  let q1 = `here is a -- dash comment`;
  let r1 = removeSQLDashComments(q1);
  t.is(r1, 'here is a ');
});
