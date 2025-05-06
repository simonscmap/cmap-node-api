const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const test = require('ava');
const cleanup = require('../../../controllers/data/bulk-download/cleanupTempDir');
const {
  bulkDownloadController,
} = require('../../../controllers/data/bulk-download');
const {
  createTempDir,
} = require('../../../controllers/data/bulk-download/createTempDir');
const directQuery = require('../../../utility/directQuery');

const mockNext = () => {
  /* no op */
};

const getHash = (pathToFile) => {
  // https://nodejs.org/docs/latest-v12.x/api/crypto.html#crypto_crypto_createhash_algorithm_options
  const input = fs.createReadStream(pathToFile);
  const hash = crypto.createHash('sha256');
  return new Promise((resolve) => {
    input.on('readable', () => {
      const data = input.read();
      if (data) hash.update(data);
      else {
        resolve(hash.digest('hex'));
      }
    });
  });
};

test('bulk-download controller large set of datasets for cruise KOK1606', async (t) => {
  /* get all datasets associated with KOK1606

select dc.Dataset_ID as id, d.Dataset_Name as shortName from tblCruise
join tblDataset_Cruises as dc on tblCruise.ID = dc.Cruise_ID
join tblDatasets as d on dc.Dataset_ID = d.ID
where tblCruise.Name = 'KOK1606';

   */
  const getDatasetShortNamesQuery = `
select dc.Dataset_ID as id, d.Dataset_Name as shortName from tblCruise
join tblDataset_Cruises as dc on tblCruise.ID = dc.Cruise_ID
join tblDatasets as d on dc.Dataset_ID = d.ID
where tblCruise.Name = 'KOK1606';
  `;

  const [err, result] = await directQuery(getDatasetShortNamesQuery, {
    description: 'get short names for datasets associated with cruise',
  });
  if (err) {
    return t.fail('failed to fetch dataset short names');
  }
  // console.log ('short names')
  const shortNames = result.recordset.map((row) => row.shortName);
  // console.log (shortNames);

  const mockReq = {
    reqId: 12345,
    body: {
      shortNames: JSON.stringify(shortNames),
    },
  };

  const EXPECTED_HASH =
    'f3c8821ec60a527c3008950631ddaac177bc35b456e8c2ec978594a8861efcfb';

  // create temporary place to write archive to
  // this stands in place of the client (browser)
  let pathToTmpDir;
  try {
    pathToTmpDir = await createTempDir();
  } catch (e) {
    t.fail('failed to create temp dir');
  }
  const destinationPath = path.join(pathToTmpDir, 'test-archive.zip');

  // create mock response object:
  // a write stream + methods: status, sendStatus,
  const mockRes = fs.createWriteStream(destinationPath);
  mockRes.locals = {
    test: true,
  };
  mockRes.status = (status) => ({
    send: (msg) => [status, msg],
  });
  mockRes.sendStatus = (status) => [status];

  // execute controller
  await bulkDownloadController(mockReq, mockRes, mockNext);

  // Compare Hash of Result
  return getHash(destinationPath)
    .then((finalHash) => {
      t.log('final hash');
      t.log(finalHash);
      t.log('expected hash');
      t.log(EXPECTED_HASH);
      t.log(shortNames);
      t.is(finalHash, EXPECTED_HASH);
    })
    .catch((reason) => {
      t.fail(reason);
    })
    .finally(() => {
      t.log(pathToTmpDir);
      cleanup(pathToTmpDir);
    });
});
