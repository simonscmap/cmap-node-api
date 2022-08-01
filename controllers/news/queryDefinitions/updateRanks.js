const S = require("../../../utility/sanctuary");
const $ = require("sanctuary-def");
const sql = require("mssql");
const { findArgByName } = require("../../lib");

let {
  concat,
  filter,
  fromMaybe,
  fromRight,
  gets,
  is,
  isRight,
  joinWith,
  Left,
  lift2,
  map,
  maybeToEither,
  none,
  pipe,
  prop,
} = S;

// TEMPLATE

/* Example:
   UPDATE [Opedia].[dbo].[tblNews]
   SET rank = CASE
              WHEN ID = 2 THEN 1
              WHEN ID = 3 THEN 3
              WHEN ID = 5 THEN 2
              ELSE rank
              END
   WHERE ID in (2, 3, 5)
 */

let rankToCaseStatement = ({ id, rank }) => `WHEN ID = ${id} THEN ${rank}`;

let getCaseStatement = pipe([
  map(map(rankToCaseStatement)), // map the Array inside the Maybe
  map(joinWith(' ')),
  fromMaybe('')
]);

let getCommaSeparatedIds = pipe ([
  map (map (prop('id'))),
  map (map (x => `${x}`)),
  map (joinWith(', ')),
  fromMaybe('')
]);

let reconcileArgsWithExistingRanks = (requestedRanks) => (existingRanks) => {
  // get ids from existing ranks
  let currentIds = map (({ id }) => id) (existingRanks)
  // get ids from requested ranks
  let requestedIds = map (({ id}) => id) (requestedRanks);
  // make a list of ids that are missing, and set rank to null
  let remainingIds = filter ((cId) => none ((rId) => rId === cId) (requestedIds)) (currentIds)
  // re-form objects with ranks to be nulled
  let nulledIds = map ((id) => ({ id, rank: null })) (remainingIds)
  // return merged lists
  return concat (requestedRanks) (nulledIds)
}

let template = (parsedArgs) => {
  let maybeRequestedRanks = findArgByName ('ranks') (parsedArgs);
  let maybeCurrentRanks = findArgByName ('currentlyRankedItems') (parsedArgs);
  let maybeReconciledList = lift2 (reconcileArgsWithExistingRanks)
    (maybeRequestedRanks)
    (maybeCurrentRanks)

  // reconcile existing ranked items with request
  let caseStatement = getCaseStatement (maybeReconciledList)
  let commaSeparatedIds = getCommaSeparatedIds (maybeReconciledList)

  let result = `UPDATE [Opedia].[dbo].[tblNews]
            SET rank = CASE ${caseStatement}
                       ELSE rank
                       END,
                UserId = @UserId,
                modify_date = @modify_date
            WHERE ID in (${commaSeparatedIds})`

  return result;
};

let rejectEmptyArrays = (x) => {
  if (isRight (x)) {
    let ranks = fromRight ([]) (x);
    if (ranks.length === 0) {
      return Left("ranks array cannot be empty"); // TODO should return 418
    }
  }
  return x;
}

let rejectNonUniqueRanks = (x) => {
  if (isRight (x)) {
    let ranks = fromRight ([]) (x);
    let rankValues = ranks.map(({ rank}) => rank );
    let uniqueRanks = new Set(rankValues);
    if (rankValues.length !== uniqueRanks.size) {
      return Left("ranks must be unique"); // TODO should return 400
    }
  }
  return x;
}

let updateRankedItemsQueryDefinition = {
  name: 'Update Ranked News Items',
  template: template,
  args: [
    {
      vName: 'ranks',
      defaultTo: [],
      resolver:  pipe ([
        gets (is ($.Array ($.StrMap ($.Integer)))) (["body", "ranks"]),
        maybeToEither ("ranks are required"),
        // if Right ([]) is an empty array, make Left ("error msg")
        rejectEmptyArrays,
        // if Right ([]) contains duplicates, make Left ("error msg")
        rejectNonUniqueRanks,
      ])
    },
    {
      vName: 'currentlyRankedItems',
      defaultTo: [],
      resolver:  pipe ([
        gets (is ($.Array ($.StrMap ($.Integer)))) (["currentlyRankedItems"]),
        map (map (({ ID, rank }) => ({ id: ID, rank }))), // normalize ID -> id
        maybeToEither ("could not resolve current ranks")
      ])
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
      defaultTo: -1,
      resolver: pipe([
        gets (is ($.Integer)) (["user", "id"]),
        maybeToEither("user id is required"),
      ])
    },
  ]
}

module.exports = updateRankedItemsQueryDefinition;
