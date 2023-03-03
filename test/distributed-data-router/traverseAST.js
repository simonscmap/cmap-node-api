const test = require("ava");
const {
  traverseAST,
  transformTopQueryToLimit,
} = require("../../utility/router/pure");


/******************************************************************************/
let nestedTop = `SELECT TOP(100) a.[time], a.[lat], a.[lon], a.[depth], b.Temperature FROM [Opedia].[dbo].[tblKOK1606_Gradients1_CTD] a inner join (select top(50)* from [tblKOK1606_Gradients1_CTD] where station = 2) b on a.time = b.time and a.lat = b.lat and a.lon = b.lon and a.depth = b.depth and a.Station = b.Station`;


// for future reference; currently we do not handle PERCENT, although the traverse function does
let topPercent = `SELECT TOP(10) PERCENT * FROM [Opedia].[dbo].[tblKOK1606_Gradients1_CTD]`;

let nestedTop2 = `SELECT TOP 100 a.[time], a.lat, a.lon, a.depth, b.Temperature  FROM [Opedia].[dbo].[tblKOK1606_Gradients1_CTD] a inner join (select top 50 * from [tblKOK1606_Gradients1_CTD] where station = 2) b on a.time = b.time and a.lat = b.lat and a.lon = b.lon and a.depth = b.depth and a.Station = b.Station`;

let qWithBackticks = "SELECT DISTINCT(Dataset_ID) FROM tblVariables WHERE LOWER(Table_Name)=LOWER(`tblAltimetry_REP_Signal`)";

let control = `WITH cruise_join (time, lat, lon) AS
             (SELECT DISTINCT i.time, i.lat, i.lon FROM tblTN398_Influx_Underway i
              INNER JOIN tblTN398_Nutrients n on CAST(i.time as date) = CAST(n.time as date)
             )
           SELECT * from cruise_join c INNER JOIN tblTN398_uw_TSG t on c.time  = t.time`;

let simpleControl = `WITH nutrients (time, lat, lon) AS
             (SELECT DISTINCT i.time, i.lat, i.lon FROM tblTN398_Nutrients
             )
           SELECT time from nutrients`;

let aliasAlias = `SELECT TOP 2 tblTN397_Gradients4_uw_par.time
      ,tblTN397_Gradients4_uw_tsg.lat
      ,tblTN397_Gradients4_uw_tsg.lon
      ,par,sst
  FROM tblTN397_Gradients4_uw_par
  inner join
  (SELECT * from tblTN397_Gradients4_uw_tsg) tblTN397_Gradients4_uw_tsg
  on tblTN397_Gradients4_uw_par.time = tblTN397_Gradients4_uw_tsg.time and tblTN397_Gradients4_uw_par.lat = tblTN397_Gradients4_uw_tsg.lat`;

/******************************************************************************/

test ("correct output nested top", (t) => {
  let [error, result] = transformTopQueryToLimit (nestedTop);
  t.is (error, false);
  let expectedOutput = `SELECT a.time, a.lat, a.lon, a.depth, b.Temperature FROM Opedia.dbo.tblKOK1606_Gradients1_CTD AS a INNER JOIN (SELECT * FROM tblKOK1606_Gradients1_CTD WHERE station = 2 LIMIT 50) AS b ON a.time = b.time AND a.lat = b.lat AND a.lon = b.lon AND a.depth = b.depth AND a.Station = b.Station LIMIT 100`;
  t.is(result, expectedOutput);
});

test ("correct output for nested top 2", (t) => {
  let [error, result] = transformTopQueryToLimit (nestedTop2);
  t.is (error, false);
  let expectedOutput = `SELECT a.time, a.lat, a.lon, a.depth, b.Temperature FROM Opedia.dbo.tblKOK1606_Gradients1_CTD AS a INNER JOIN (SELECT * FROM tblKOK1606_Gradients1_CTD WHERE station = 2 LIMIT 50) AS b ON a.time = b.time AND a.lat = b.lat AND a.lon = b.lon AND a.depth = b.depth AND a.Station = b.Station LIMIT 100`;
  t.is(result, expectedOutput);
});

test ("can parse PERCENT", (t) => {
  let [error] = traverseAST (topPercent);
  t.is (error, false);
});

test ("can parse CTE", (t) => {
  let [error] = traverseAST (control);
  t.is (error, false);

  let [error2] = traverseAST (simpleControl);
  t.is (error2, false);
});

test ("can parse queries with backticks", (t) => {
  let [error, result] = traverseAST (qWithBackticks);
  t.is (error, false);
  console.error (result);

});
