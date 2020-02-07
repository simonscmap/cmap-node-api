const base64url = require('base64-url')

const awaitableEmailClient = require('../utility/emailAuth');
const emailTemplates = require('../utility/emailTemplates');

exports.contactUs = async(req, res, next) => {
    let payload = req.body;
    console.log(payload);

    let emailClient = await awaitableEmailClient;
    let content = emailTemplates.contactUs(payload);
    let message =
        "From: 'me'\r\n" +
        "To: simonscmap@uw.edu\r\n" +
        "Subject: Message from Simons CMAP User\r\n" +
        // "Content-Type: text/html; charset='UTF-8'\r\n" +
        // "Content-Transfer-Encoding: base64\r\n\r\n" +
        content;

    let raw = base64url.encode(message);

    try {
        let result = await emailClient.users.messages.send({
            userId: 'me',
            resource: {
                raw
            }
        })
    
        res.sendStatus(200);
    } catch(e) {
        res.sendStatus(400);
    }

    return next();
}