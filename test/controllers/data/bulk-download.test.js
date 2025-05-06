const test = require('ava');
const {
  bulkDownloadController,
} = require('../../../controllers/data/bulk-download');

const mockNext = () => {
  /* no op */
};
test('bulk-download controller: bad request, no shortNames ', async (t) => {
  const mockReq = {
    reqId: 12345,
    body: {}, // no short names arg
  };

  // create mock response object:
  // a write stream + methods: status, sendStatus,
  const mockRes = {};
  mockRes.locals = {
    test: true,
  };
  mockRes.status = (status) => ({
    send: (msg) => {
      t.is(msg, 'bad request: missing argument');
      t.is(status, 400);
    },
  });

  mockRes.sendStatus = (status) => [status];

  // execute controller
  await bulkDownloadController(mockReq, mockRes, mockNext);
});

test('bulk-download controller: bad request ', async (t) => {
  const mockReq = {
    reqId: 12345,
    body: {
      shortNames: 'invalid json',
    },
  };

  // create mock response object:
  // a write stream + methods: status, sendStatus,
  const mockRes = {};
  mockRes.locals = {
    test: true,
  };
  mockRes.status = (status) => ({
    send: (msg) => {
      t.is(msg, 'bad request: invalid json');
      t.is(status, 400);
    },
  });

  mockRes.sendStatus = (status) => [status];

  // execute controller
  await bulkDownloadController(mockReq, mockRes, mockNext);
});

test('bulk-download controller: no matching dataset', async (t) => {
  const mockReq = {
    reqId: 12345,
    body: {
      shortNames: JSON.stringify(['my_non_existent_dataset']),
    },
  };

  // create mock response object:
  // a write stream + methods: status, sendStatus,
  const mockRes = {};
  mockRes.locals = {
    test: true,
  };
  mockRes.status = (status) => ({
    send: (msg) => {
      t.is(msg, 'no matching dataset');
      t.is(status, 400);
    },
  });

  mockRes.sendStatus = (status) => [status];

  // execute controller
  await bulkDownloadController(mockReq, mockRes, mockNext);
});
