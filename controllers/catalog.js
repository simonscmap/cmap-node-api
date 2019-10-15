const queryHandler = require('../utility/queryHandler');

exports.retrieve = async (req, res, next) => {
    queryHandler(req, res, next, 'SELECT * from dbo.udfCatalog()');
}