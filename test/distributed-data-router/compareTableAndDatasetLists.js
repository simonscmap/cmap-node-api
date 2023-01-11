const test = require("ava");
const {
  compareTableAndDatasetLists,
} = require("../../utility/router/pure");

/* compareTableAndDataselt lists should produce a list of core tables,
 * and a list of dataset tables;
 * the input is the result of two queries, one fetches the names of all
 * on-prem tables, the other a list of all dataset tables (whether the
 * dataset in on-prem on not.
 */
test("returns lists of core and dataset tables", (t) => {
  let mockOnPremTableList = [
    { Table_Name: 'tblCoreTable' },
    { Table_Name: 'tblDataset1' },
    { Table_Name: 'tblDataset2' },
  ];
  let mockDatasetTableList = [
    { Table_Name: 'tblDataset1' },
    { Table_Name: 'tblDataset2' },
    { Table_Name: 'tblDataset3' },
  ];

  let result = compareTableAndDatasetLists(mockOnPremTableList, mockDatasetTableList);

  t.deepEqual(
    result,
    {
      coreTables: [
        'tblCoreTable',
      ],
      datasetTables: [
        'tblDataset1',
        'tblDataset2',
        'tblDataset3',
      ],
    }
  );
});
