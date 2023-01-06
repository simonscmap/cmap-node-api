const test = require("ava");
const {
  isSproc,
} = require("../../utility/router/pure");

test("detects EXEC in query string", (t) => {
  // basic exec
  let q1 = "EXEC sproc 'tblMyTable'";
  let r1 = isSproc(q1);
  t.truthy(r1);
});

test("ignores dash-commented EXEC in query string", (t) => {
  // commented execs, should not be false positives
  let q2 = `-- EXEC sproc 'tblFakeTable'
            SELECT * from myTable`;
  let r2 = isSproc(q2);
  t.falsy(r2);

  let q3 = `-- EXEC sproc 'tblFakeTable'
            /* EXEC
               EXEC
            */
            SELECT * from myTable`;
  let r3 = isSproc(q3);
  t.falsy(r3);
});

test("ignores multiline-commented EXEC in query string", (t) => {
  let q3 = `-- EXEC sproc 'tblFakeTable'
            /* EXEC
               EXEC
            */
            SELECT * from myTable`;
  let r3 = isSproc(q3);
  t.falsy(r3);
});
