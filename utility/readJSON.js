const Future = require('fluture');
const S = require('./sanctuary');
const fs = require('fs');

const { node } = Future;

// given a file path, read the file and attempt to parse it as json
// return a future of the parsed file
const readJSON = (filePath) =>
  node((done) => fs.readFile(filePath, 'utf-8', done)).pipe(
    S.chain(Future.encase(JSON.parse)),
  );

module.exports = readJSON;
