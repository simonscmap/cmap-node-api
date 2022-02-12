const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const TOKEN_PATH = 'token.json';

const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);

// Initializes email client for sending no-reply mail. Assists in creating a new credentials file if one is missing
const emailClientInit = async () => {
    let credentials = JSON.parse(await readFileAsync('./credentials.json'));

    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    try{
      const token = await readFileAsync(TOKEN_PATH);
      let parsed = JSON.parse(token);

      oAuth2Client.setCredentials(parsed);
    } catch(e) {
        console.log('HI')
        return getNewToken(oAuth2Client, emailClientInit);
    }

    return google.gmail({version: 'v1', auth: oAuth2Client});
}

module.exports = emailClientInit();

// Only runs once to generate initial access and refresh token
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('Authorize this app by visiting this url:', authUrl);
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      return callback(oAuth2Client);
    });
  });
}
