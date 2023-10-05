// https://nodejs.org/docs/latest-v12.x/api/crypto.html#crypto_crypto_createhash_algorithm_options
const crypto = require('crypto');
const fs = require('fs');

const filename = process.argv[2];

const input = fs.createReadStream(filename);

const hash = crypto.createHash('sha256');

input.on('readable', () => {
  const data = input.read();
  if (data)
    hash.update(data);
  else {
    console.log(hash.digest('hex'));
  }
});
