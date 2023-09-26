const S = require("../../../utility/sanctuary");
const $ = require("sanctuary-def");
const sql = require('mssql');
// const { trace } = require('../../lib')

let {
  bimap,
  empty,
  encase,
  gets,
  join,
  ifElse,
  is,
  isJust,
  map,
  maybeToEither,
  pipe,
  Right,
} = S;

let maybeNothingToRight = ifElse (isJust) (maybeToEither ("Oops")) ((arg) => Right(arg));

let makeErrorMessage = (e) => {
  if (typeof e === 'object') {
    return `body is invalid json: ${e.message}`
  } else if (typeof e === 'string') {
    return e;
  } else {
    return 'unexpected error resolving body';
  }
}

let bodyResolver = pipe([
  gets (is ($.String))(["body", "story", "body"]),
  // Just (String) | Nothing
  map (encase (JSON.parse)),
  // Just (Right (Object)) | Just (Left (SyntaxError)) | Nothing
  maybeToEither ("body is required"),
  // Right (Right (Object)) | Right (Left (SyntaxError)) | Left (msg)
  join,
  // Right (Object) | Left (SyntaxError))| Left (msg)
  bimap (makeErrorMessage) (JSON.stringify),
]);

let template = () => `INSERT INTO [Opedia].[dbo].[tblNews]
      (ID, headline, link, body, date, rank, view_status, create_date, UserID, Status_ID, Highlight)
      VALUES (
         @ID
       , @headline
       , @link
       , @body
       , @date
       , @rank
       , @view_status
       , @create_date
       , @UserId
       , @Status_ID
       , @Highlight
      )`;


let createStoryQueryDefinition = {
  name: 'Create News Story',
  template: template,
  args: [
    {
      vName: "ID",
      sqlType: sql.Int,
      defaultTo: 0,
      resolver: pipe([
        gets (is ($.Integer)) (["topStoryId"]),
        maybeToEither("could not resolve story id"), // note that this comes from prev query
      ]),
    },
    {
      vName: "headline",
      sqlType: sql.NVarChar,
      defaultTo: empty (String),
      // even though this field is NVarChar, we'll require a headline
      resolver: pipe([
        gets (is ($.String)) (["body", "story", "headline"]),
        maybeToEither("headline is required"),
      ]),
    },
    {
      vName: "link",
      sqlType: sql.NVarChar,
      defaultTo: S.empty (String),
      resolver: pipe([
        gets (is ($.String)) (["body", "story", "link"]),
        maybeNothingToRight,
      ]),
    },
    {
      vName: "body",
      sqlType: sql.NVarChar,
      defaultTo: S.empty(String),
      resolver: bodyResolver
    },
    {
      vName: "date",
      sqlType: sql.NVarChar,
      defaultTo: S.empty(String),
      resolver: pipe([
        gets (is ($.String)) (["body", "story", "date"]),
        maybeNothingToRight,
      ]),
    },
    {
      vName: "view_status",
      sqlType: sql.Int,
      defaultTo: 2, // start new stories in Draft status
      resolver: () => Right(2),
    },
    {
      vName: "rank",
      sqlType: sql.Int,
      defaultTo: null,
      resolver: () => Right(null),
    },
    {
      vName: "create_date",
      sqlType: sql.DateTime,
      defaultTo: (new Date()).toISOString(),
      resolver: () => S.Right((new Date()).toISOString())
    },
    {
      vName: "UserID",
      sqlType: sql.Int,
      defaultTo: -1,
      resolver: pipe([
        gets (is ($.Integer)) (["user", "id"]),
        maybeToEither("user id is required"),
      ])
    },
    {
      vName: "Status_ID",
      sqlType: sql.INT,
      defaultTo: 0,
      resolver: pipe([
        gets (is ($.Integer)) (["body", "story", "Status_ID"]),
        maybeToEither ('Expecting an integer'),
      ]),
    },
    {
      vName: "Highlight",
      sqlType: sql.INT,
      defaultTo: 0,
      resolver: pipe([
        gets (is ($.Integer)) (["body", "story", "Highlight"]),
        maybeToEither ('Expecting an integer'),
      ]),
    },
  ]
}

module.exports = createStoryQueryDefinition;
