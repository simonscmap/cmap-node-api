const crypto = require('crypto');
const fs = require ('fs');
const path = require('path');
const test = require('ava');
const cleanup = require('../../../controllers/data/bulk-download/cleanupTempDir')
const { bulkDownloadController } = require('../../../controllers/data/bulk-download');
const { createTempDir } = require('../../../controllers/data/bulk-download/createTempDir');

const mockNext = () => { /* no op */};

const getHash = (pathToFile) => {
  // https://nodejs.org/docs/latest-v12.x/api/crypto.html#crypto_crypto_createhash_algorithm_options
  const input = fs.createReadStream(pathToFile);
  const hash = crypto.createHash('sha256');
  return new Promise((resolve) => {
    input.on('readable', () => {
      const data = input.read();
      if (data)
        hash.update(data);
      else {
        resolve(hash.digest('hex'));
      }
    });
  })
}

test ('bulk-download controller simple test HOT001', async (t) => {
  const mockReq = {
    reqId: 12345,
    body: {
      shortNames: JSON.stringify(['HOT_PP']), // only dataset associated with HOT001
    }
  };

  const HOT001_HASH = 'eeab60a123524d4a7cc16c71c16054fd55e8fc41b1e1a2217bcc0097649246d5';

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
  }
  mockRes.status = (status) => ({
    send: (msg) => ([status, msg]),
  });
  mockRes.sendStatus = (status) => ([status]);

  // execute controller
  await bulkDownloadController(mockReq, mockRes, mockNext);

  // Compare Hash of Result
  return getHash(destinationPath)
    .then((finalHash) => {
      t.log ('final hash')
      t.log (finalHash);
      t.log ('expected hash');
      t.log (HOT001_HASH);
      t.is(finalHash, HOT001_HASH);

    }).catch((reason) => {
      t.fail(reason);
    }).finally(() => {
      cleanup(pathToTmpDir);
    });
});
