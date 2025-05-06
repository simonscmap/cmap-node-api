const {
  shouldExpandStar,
  replaceStarWithCols,
} = require('../../../utility/download/expandSelect');
const test = require('ava');

test('shouldExpandStar correctly identifies cases', (t) => {
  // 1
  let ex1 = 'select * from tblMyTable';
  let res1 = shouldExpandStar(ex1);

  t.is(res1, true);

  // 2
  let ex2 = 'select this, that from tblMyTable';
  let res2 = shouldExpandStar(ex2);

  t.is(res2, false);

  // 3
  let ex3 =
    '/* block comment with select * from */ select this, that from tblMyTable';
  let res3 = shouldExpandStar(ex3);

  t.is(res3, false);

  // 4
  let ex4 = `-- dasch  comment with select * from
 select this, that from tblMyTable`;
  let res4 = shouldExpandStar(ex4);

  t.is(res4, false);

  // 5
  let ex5 = '/* */ select * from tblMyTable';
  let res5 = shouldExpandStar(ex5);

  t.is(res5, true);

  // 6
  let ex6 = '-- select * from tblMyTable';
  let res6 = shouldExpandStar(ex6);

  t.is(res6, false);

  // 7
  let ex7 = 'select TOP 1 * from tblMyTable';
  let res7 = shouldExpandStar(ex7);

  t.is(res7, true);
});

test('replaceStarWithCols correctly replaces star with column names', (t) => {
  let cols = ['one', 'two', '+three'];

  let ex1 = 'select top 2 * from myTable';
  let res1 = replaceStarWithCols(ex1, cols);

  t.is(res1, 'select top 2 [one], [two], [+three] from myTable');
});

test('shouldExpandStar ignores queries with join', (t) => {
  let ex1 = 'select * from tblMyTable join myTable2';
  let res1 = shouldExpandStar(ex1);

  t.is(res1, false);
});
