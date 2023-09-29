const sql = require("mssql");
const S = require("../../utility/sanctuary");
const $ = require("sanctuary-def");
const { generateController } = require("../futureController");

let { compose, gets, is, maybeToEither, fromMaybe } = S;

// function pieces for arg resolvers
let eitherIdOrError = maybeToEither ("id is required");
let getIdFromReq = gets (is ($.Integer)) (["body", "story", "ID"]);

let eitherHeadlineOrError = maybeToEither ("headline is required");
let getHeadlineFromReq = gets (is ($.String)) (["body", "story", "headline"]);

let eitherLinkOrError = maybeToEither ("link is required");
let getLinkFromReq = gets (is ($.String)) (["body", "story", "link"]);

let eitherBodyOrError = maybeToEither ("body is required");
let getBodyFromReq = gets (is ($.String)) (["body", "story", "body"]);

let eitherDateOrError = maybeToEither ("date is required");
let getDateFromReq = gets (is ($.String)) (["body", "story", "date"]);

let getLabelFromReq = gets (is ($.String)) (["body", "story", "label"]);

// Update News Item, Query Definition
// Only used for updating the content of a news item
// Use setRanks for updating rank, and
// use publish/preview/draft/hide for setting view_status
let updateQueryDefinition = {
  name: 'Update News Item',
  // TODO: update UserID as well
  template: () => `UPDATE [Opedia].[dbo].[tblNews]
      SET
        headline = @headline,
        label = @label,
        link = @link,
        body = @body,
        date = @date,
        modify_date = @modify_date
      WHERE ID = @ID`,
  args: [
    {
      vName: 'ID',
      sqlType: sql.Int, // todo: check
      defaultTo: 0,
      resolver: compose (eitherIdOrError) (getIdFromReq),
    },
    {
      vName: 'label',
      sqlType: sql.VarChar, // todo: check
      defaultTo: '',
      resolver: compose (S.Right)
        (compose (fromMaybe ('')) (getLabelFromReq))
    },
    {
      vName: 'headline',
      sqlType: sql.VarChar, // todo: check
      defaultTo: '',
      resolver: compose (eitherHeadlineOrError) (getHeadlineFromReq),
    },
    {
      vName: 'link',
      sqlType: sql.VarChar, // todo: check
      defaultTo: '',
      resolver: compose (eitherLinkOrError) (getLinkFromReq),
    },
    {
      vName: 'body',
      sqlType: sql.VarChar, // todo: check
      defaultTo: '',
      resolver: compose (eitherBodyOrError) (getBodyFromReq),
    },
    {
      vName: 'date',
      sqlType: sql.VarChar, // todo: check
      defaultTo: '',
      resolver: compose (eitherDateOrError) (getDateFromReq),
    },
    {
      vName: 'modify_date',
      sqlType: sql.DateTime,
      defaultTo: (new Date()).toISOString(),
      resolver: () => {
        return S.Right((new Date()).toISOString())
      }
    }
    // TODO: get user as well
  ]
}

const controller = generateController(updateQueryDefinition);

module.exports = controller;
