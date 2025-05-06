const test = require('ava');
const { removeSQLBlockComments } = require('../../utility/router/pure');

test('removeSQLBlockComments', (t) => {
  let q1 = `here is a /**/ block comment`;
  let r1 = removeSQLBlockComments(q1);
  t.is(r1, 'here is a  block comment');

  let q0 = `here are several /**/ block /**/ comments /**/`;
  let r0 = removeSQLBlockComments(q0);
  t.is(r0, 'here are several  block  comments ');

  let q2 = `here is
a multiline /*
 comment
 comment
*/ block comment`;
  let r2 = removeSQLBlockComments(q2);
  t.is(r2, 'here is\na multiline  block comment');

  let q3 = 'here is a \n multi-line /* comment \n comment \n */ block comment';
  let r3 = removeSQLBlockComments(q3);
  t.is(r3, 'here is a \n multi-line  block comment');
});
