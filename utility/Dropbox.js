var fetch = require('isomorphic-fetch');
var Dropbox = require('dropbox').Dropbox;

// Create and export an instance of the dropbox class
module.exports.dropbox = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch: fetch });