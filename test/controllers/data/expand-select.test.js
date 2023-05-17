const { shouldExpandStar } = require('../../../utility/download/expandSelect')
const test = require("ava");



test("shouldExpandStar correctly identifies cases", (t) => {
  let ex1 = 'select * from tblMyTable';
  let res1 = shouldExpandStar (ex1);

  t.is(res1, true);

  let ex2 = 'select this, that from tblMyTable';
  let res2 = shouldExpandStar (ex2);

  t.is(res2, false);

  let ex3 = '/* block comment with select * from */ select this, that from tblMyTable';
  let res3 = shouldExpandStar (ex3);

  t.is(res3, false);

  let ex4 = `-- dasch  comment with select * from
 select this, that from tblMyTable`;
  let res4 = shouldExpandStar (ex4);

  t.is(res4, false);

  let ex5 = '/* */ select * from tblMyTable';
  let res5 = shouldExpandStar (ex5);

  t.is(res5, true);

  let ex6 = '-- select * from tblMyTable';
  let res6 = shouldExpandStar (ex6);

  t.is(res6, false);
});

test("shouldExpandStar ignores queries with join", (t) => {
  let ex1 = 'select * from tblMyTable join myTable2';
  let res1 = shouldExpandStar (ex1);

  t.is(res1, false);
});
