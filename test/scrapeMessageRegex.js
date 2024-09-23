const test = require("ava");

test("extract recipient from email message", (t) => {

  const message = `From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>
To: someoneg@gmail.com
Auto-Submitted: auto-replied
Subject: Delivery Status Notification (Failure)
References: <..........................@mail.gmail.com>
In-Reply-To: <..........................@mail.gmail.com>
X-Failed-Recipients: intended.recipient@someaddress.com
Message-ID: <........................@mx.google.com>
Date: Mon, 29 Jul 2000 12:00:00 -0700 (PDT)

--000000000000bfad8e058edbf1ae
Content-Type: multipart/related; boundary="000000000000bfb59a058edbf1cf"

--000000000000bfb59a058edbf1cf
Content-Type: multipart/alternative; boundary="000000000000bfb5a6058edbf1d0"
`;

  const re = /\nX-Failed-Recipients:\s(.+)\n/gi;

  const match = re.exec(message);

  t.is (true, Array.isArray (match));
  t.is (match[1], "intended.recipient@someaddress.com");

});



test("extract email emailId from email message", (t) => {

  const message = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta name="viewport" content="width=device-width" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="emailId" content="999" />
    <title>__</title>
`;

  const emailIdRe = /<meta name="emailId".content="(\d+)" \/>/gi;

  const match = emailIdRe.exec(message);

  t.is (true, Array.isArray (match));
  t.is (match[1], "999");

});
