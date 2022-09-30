# Utility

Notes on the contents of this directory

# email

The email directory contains functions and templates for sending emails to admins and users alike.

Read especially the documentation in the email/templates directory.

# Google Service Account Key File

There should be a key file in this directory, but it should never be committed to source control. It can be moved so long as the reference to its path is updated in the module(s) where a google api client is generated with this authorization strategy, for example in `serviceAccountAuth.js`.

# How To

To send an email, use the `sendServiceMail` function exported in `email/sendMail.js`. This function automatically uses the correct authentication.
