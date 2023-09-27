const S = require("../../../utility/sanctuary");
const $ = require("sanctuary-def");
const sql = require("mssql");

let {
  pipe,
  maybeToEither,
  gets,
  is,
} = S;

let template = () =>
  `UPDATE [Opedia].[dbo].[tblNews]
   SET
     Status_ID = @Status_ID,
     modify_date = @modify_date,
     UserID = @UserID
   WHERE ID = @ID`;

let unpublishQueryDefinition = {
  name: "Set News Item Category",
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
      vName: "Status_ID",
      sqlType: sql.Int,
      defaultTo: 0,
      resolver: pipe([
        gets(is($.Integer))(["body", "category"]),
        maybeToEither("value for statusId is required"),
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
