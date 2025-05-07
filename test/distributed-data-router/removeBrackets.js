const test = require('ava');
const { removeBrackets } = require('../../utility/router/pure');

test('removes tsql brackets from query', (t) => {
  let tsqlQuery1 = 'select max([time]) from tblMITgcm_SWOT_2D';
  let result = removeBrackets(tsqlQuery1);
  t.is(result, 'select max(time) from tblMITgcm_SWOT_2D');
});
