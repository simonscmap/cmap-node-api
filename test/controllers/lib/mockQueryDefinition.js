const sql = require('mssql');
const S = require('../../../utility/sanctuary');
const $ = require('sanctuary-def');

let parseId = S.maybeToEither('ID is required');
let getIdFromReq = S.gets(S.is($.Integer))(['body', 'id']);
let idResolver = S.compose(parseId)(getIdFromReq);

// an example of a working Query Definition
// however, the use of a resolver may be complicated by the
// needs of the Either type constraint, and may change
let mockDeleteQueryDefinition = {
  name: 'Delete News Item',
  template: () => `DELETE [Opedia].[dbo].[tblNews]
       WHERE id = @ID`,
  args: [
    {
      vName: 'ID',
      sqlType: sql.Int,
      defaultTo: 0, // this is the $ type to satisfy the fromRight function
      resolver: idResolver, // req -> ethier [ value or message ]
    },
  ],
};

// in this sample, the resolver enforces a nullable string type,
// so we would expect that if an integer was provided, it would
// reject the arg, while if null were provided, it would be accepted as valid
let mockSampleQuery = {
  name: 'sample',
  template: () => ``,
  args: [
    {
      vName: 'Name',
      sqlType: sql.NVarChar,
      defaultTO: null,
      resolver: S.compose(S.maybeToEither('Name must be a nullable string'))(
        S.gets(S.is($.Nullable($.String)))(['body', 'name']),
      ),
    },
  ],
};

let mockMultiArgQuery = {
  name: 'multiple input query',
  template: () => ``,
  args: [
    {
      vName: 'id',
      sqlType: sql.Int,
      defaultTO: 0,
      resolver: S.compose(S.maybeToEither('id is required'))(
        S.gets(S.is($.Integer))(['body', 'story', 'id']),
      ),
    },
    {
      vName: 'title',
      sqlType: sql.VarChar,
      defaultTO: '',
      resolver: S.compose(S.maybeToEither('title is required'))(
        S.gets(S.is($.String))(['body', 'story', 'title']),
      ),
    },
    {
      vName: 'headline',
      sqlType: sql.VarChar,
      defaultTO: '',
      resolver: S.compose(S.maybeToEither('headline is required'))(
        S.gets(S.is($.String))(['body', 'story', 'headline']),
      ),
    },
  ],
};

module.exports = {
  mockDeleteQueryDefinition,
  mockMultiArgQuery,
};
