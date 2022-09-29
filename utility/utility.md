# Utility

Notes on the contents of this directory

# Google Service Account Key File

There should be a key file in this directory, but it should never be committed to source control. It can be moved so long as the reference to its path is updated in the module(s) where a google api client is generated with this authorization strategy, for example in `serviceAccountAuth.js`.
