const test = require("ava");
const updateRankQDef = require("../../../controllers/news/queryDefinitions/updateRanks");
const S = require("../../../utility/sanctuary");

test("updateRankedItems Query Definition", (t) => {
  let { template } = updateRankQDef;

  // make the first item in the parsedArgs array a mismatch,
  // to test the ability of the template to correctly match
  // the needed arg
  let parsedArgs = [
    { vName: null },
    {
      vName: "ranks",
      eitherVal: S.Right([
        {
          ID: 1,
          rank: 1,
        },
      ]),
    },
    // currentlyRankedItems must be set, even if it is an empty array
    // otherwise the template will not generate a WHEN clause
    { vName: "currentlyRankedItems", eitherVal: S.Right([])},
  ];

  let result = template(parsedArgs);

  let expected = `UPDATE [Opedia].[dbo].[tblNews]
            SET rank = CASE WHEN ID = 1 THEN 1
                       ELSE rank
                       END,
                UserId = @UserId,
                modify_date = @modify_date
            WHERE ID in (1)`;
  t.is(result, expected);
});
