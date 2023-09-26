const S = require("../../../utility/sanctuary");
const $ = require("sanctuary-def");
const sql = require("mssql");

let {
  pipe,
  maybeToEither,
  gets,
  is,
  map,
} = S;

let template = () =>
  `UPDATE [Opedia].[dbo].[tblNews]
   SET
     Highlight = @Highlight,
     modify_date = @modify_date,
     UserID = @UserID
   WHERE ID = @ID`;

let unpublishQueryDefinition = {
  name: "Toggle Feature News Item",
  template: template,
  args: [
    {
      vName: "ID",
      sqlType: sql.Int,
      defaultTo: 0,
      resolver: pipe([
        gets(is($.Integer))(["body", "id"]),
        maybeToEither("story id is required"),
      ]),
    },
    {
      vName: "Highlight",
      sqlType: sql.NVarChar,
      defaultTo: "0",
      resolver: pipe([
        gets(is($.String))(["body", "current"]),
        maybeToEither("current value is required"),
        map ((val) => {
          console.log ('resolver val', val);
          if (val === "0") { // toggle the current value
            return "1";
          } else {
            return "0";
          }
        }),
      ]),
    },
    {
      vName: "modify_date",
      sqlType: sql.DateTime,
      defaultTo: (new Date()).toISOString(),
      resolver: () => S.Right((new Date()).toISOString())
    },
    {
      vName: "UserID",
      sqlType: sql.Int,
      defaultTo: 1,
      resolver: pipe([
        gets(is($.Integer))(["user", "id"]),
        maybeToEither("user id is required"),
      ])
    },
  ],
};

module.exports = unpublishQueryDefinition;
