# Utility

Notes on certain contents of this directory.

# email

The email directory contains functions and templates for sending emails to admins and users alike.

Read especially the documentation in the email/templates directory.

## Google Service Account Key File

There should be a key file in this directory, but it should never be committed to source control. It can be moved so long as the reference to its path is updated in the module(s) where a google api client is generated with this authorization strategy, for example in `serviceAccountAuth.js`.

## How To

To send an email, use the `sendServiceMail` function exported in `email/sendMail.js`. This function automatically uses the correct authentication.

# constants

An ideal location to store constant values.

# nodeCache

A wrapper around an in-memory cache. Consider the cache defaults carefully.

# queryHandler

A critical function, through which every custom query is routed. Applies round robin, and distributed data router.

# queryToDatabaseTarget

The distributed data router. Parses incoming queries, detemines which tables are visited, determines which databases contain those tables, and provides a list of viable database targets to the caller.

See additional notes in [/utility/distributed-datasets.md](distributed-datasets).

# sanctuary

Initialize the sanctuary instance. Applies types for fluture. Turns off run-time type checking in production.

# cacheAsync

A function which handles the caching of the result of a provided async function and a cache key. Note the required function signature.
