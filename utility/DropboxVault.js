const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox');

// create client with ability to refresh its auth token
const auth = new Dropbox.DropboxAuth ({
  fetch,
  clientId: process.env.DB_VAULT_APP_KEY,
  clientSecret: process.env.DB_VAULT_APP_SECRET,
  accessToken: process.env.DB_VAULT_ACCESS_TOKEN,
  refreshToken: process.env.DB_VAULT_REFRESH_TOKEN,
});

const dbx = new Dropbox.Dropbox ({
  fetch,
  auth
});

module.exports = dbx;
