const { google } = require('googleapis');
const S = require('./sanctuary');
const Future = require('fluture');
const readJSON = require('./readJSON')
const TOKEN_PATH = "token.json";

const { ap, resolve } = Future;

const generateClientFromCredentials = (creds) => {
  const {client_secret, client_id, redirect_uris} = creds.installed;
  return new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
}

const readCredentials = readJSON('./credentials.json')
  .pipe(S.map (generateClientFromCredentials))

const readToken = readJSON(TOKEN_PATH)

const getGmailClient = client => token => {
  client.setCredentials(token);
  return google.gmail({ version: 'v1', auth: client });
}

const init = ap (readToken)
               (ap (readCredentials)
                 (resolve(getGmailClient)))


module.exports = {
  init,
}
