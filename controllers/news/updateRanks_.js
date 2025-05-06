const sql = require('mssql');
const pools = require('../../dbHandlers/dbPools');
const Future = require('fluture');
const directQuery = require('../../utility/directQuery');
const initializeLogger = require('../../log-service');

const fetchRankedItems = async () => {
  const options = {
    description: 'fetch ranked news items',
  };
  const query = `SELECT [ID], [rank]
    FROM [Opedia].[dbo].[tblNews]
    WHERE rank IS NOT NULL`;
  return directQuery(query, options);
};

const updateRank = async (userId, newsIds) => {
  const options = {
    description: 'update news item ranks',
  };
  const query = `UPDATE [Opedia].[dbo].[tblNews]
                 SET rank = CASE ${caseStatement}
                            ELSE rank
                            END,
                     UserId = @UserId,
                     modify_date = @modify_date
                 WHERE ID in (${commaSeparatedIds})`;
  return directQuery(query, options);
};

// Controller
const updateRankController = async (req, res) => {
  const log = initializeLogger('update rank controller');

  // check args

  const [err, result] = await fetchRankedItems();
};

module.exports = updateRankController;
