const test = require("ava");
const {
  extractTableNamesFromAST,
  queryToAST,
} = require("../../utility/router/pure");

test("parses simple query", (t) => {
  // parse a simple query
  let q = "select * from tblMyTable";
  let ast = queryToAST(q);
  let r = extractTableNamesFromAST(ast.parserResult);
  t.deepEqual(r, ["tblMyTable"]);
});

test("parses empty query", (t) => {
  // parse an empty query
  // NOTE: extractTableNamesFromAST will get [] for an AST
  // and will swallow an error trying to access the prop it wants
  let ast2 = queryToAST("");
  let r2 = extractTableNamesFromAST(ast2.parserResult);
  t.deepEqual(r2, []);
});

test("parses commented EXEC", (t) => {
  // parse a query with an EXEC commented out /* */, but with a SELECT command
  let q3 = "/* EXEC sproc 'tblFake'*/ select * from tblMyTable";
  let ast3 = queryToAST(q3);
  let r = extractTableNamesFromAST(ast3.parserResult);
  t.is(r.length, 1);
  t.assert(r.includes("tblMyTable"));
});

test("parses TSQL", (t) => {
  // parse a query with an EXEC commented out /* */, but with a SELECT command
  let q4 = `SELECT TOP (1000) [ID],[User_ID]
      ,[Route_ID]
      ,[Query]
      ,[URL_Path]
  FROM [Opedia].[dbo].[tblApi_Calls]
  WHERE ID = 56305734`;
  let ast4 = queryToAST(q4);
  let r = extractTableNamesFromAST(ast4.parserResult);
  t.is(r.length, 1);
  t.assert(r.includes("tblApi_Calls"));
});

test("parses join (1)", (t) => {
  // parse a query with an EXEC commented out /* */, but with a SELECT command
  let q = `WITH cruise_join (time, lat, lon) AS
             (SELECT DISTINCT i.time, i.lat, i.lon FROM tblTN398_Influx_Underway i
              INNER JOIN tblTN398_Nutrients n on CAST(i.time as date) = CAST(n.time as date)
             )
           SELECT * from cruise_join c INNER JOIN tblTN398_uw_TSG t on c.time  = t.time`;
  let ast = queryToAST(q);
  t.assert(!!ast);
  let r = extractTableNamesFromAST(ast.parserResult);
  ["tblTN398_Influx_Underway", "tblTN398_Nutrients", "cruise_join", "tblTN398_uw_TSG"]
    .forEach((tblName) => t.assert(r.includes(tblName)));
});

test("parses join (2)", (t) => {
  // parse a query with an EXEC commented out /* */, but with a SELECT command
  let q = `SELECT distinct Subtrophic_Level as [title] from tblOrgTrophic_Level ot left join tblOrgSubtrophics s on s.Subtrophic_ID=ot.Subtrophic_ID`;

  let ast = queryToAST(q);
  t.assert(!!ast);
  let r = extractTableNamesFromAST(ast.parserResult);
  ['tblOrgTrophic_Level', 'tblOrgSubtrophics']
    .forEach((tblName) => t.assert(r.includes(tblName)));
});
