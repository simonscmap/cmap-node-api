const test = require("ava");
const {
  isSproc,
} = require("../../utility/router/pure");

test("detects EXEC/EXECTUE with sproc name in query string", (t) => {
  // basic exec
  let q1 = "EXEC uspBlah 'tblMyTable'";
  let r1 = isSproc(q1);
  t.truthy(r1);

  // basic exec
  let q2 = "EXECUTE badSprocName 'tblMyTable'";
  let r2 = isSproc(q2);
  t.falsy(r2);

  // basic exec
  let q3 = "EXECUTE uspBlah 'tblMyTable'";
  let r3 = isSproc(q3);
  t.truthy(r3);

  // basic exec
  let q4 = "EXEC badSprocName 'tblMyTable'";
  let r4 = isSproc(q4);
  t.falsy(r4);
});

test("ignores dash-commented EXEC in query string", (t) => {
  // commented execs, should not be false positives
  let q2 = `-- EXEC uspBlah 'tblFakeTable'
            SELECT * from myTable`;
  let r2 = isSproc(q2);
  t.falsy(r2);

  let q3 = `-- EXEC uspBlah 'tblFakeTable'
            /* EXEC
               EXEC
            */
            SELECT * from myTable`;
  let r3 = isSproc(q3);
  t.falsy(r3);
});

test("ignores multiline-commented EXEC in query string", (t) => {
  let q3 = `-- EXEC uspBlah 'tblFakeTable'
            /* EXEC
               EXEC
            */
            SELECT * from myTable`;
  let r3 = isSproc(q3);
  t.falsy(r3);
});
