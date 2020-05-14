var fetch = require('isomorphic-fetch');
var Dropbox = require('dropbox').Dropbox;

module.exports.dropbox = new Dropbox({ accessToken: process.env.DROPBOX_TOKEN, fetch: fetch });