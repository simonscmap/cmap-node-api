const crypto = require('crypto');

// We hash a stringified object literal to compare to future requests made with this token.
// This both obscures what information we're using to attempt to provide a psuedo-identity for the guest,
// and recognizes if a user manually copies the token from their browser to some other client without altering
// headers to match their browser.

module.exports = (req) => {
  let guestTokenProps = {
    browser: req.useragent.browser,
    os: req.useragent.os,
  };

  let toHash = JSON.stringify(guestTokenProps);
  let hashed = crypto.createHash('sha1').update(toHash).digest('base64');

  return hashed;
};
