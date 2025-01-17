# Utility

Notes on the contents of the `/utility` directory.

---

## `download/`

## `email/`

The email directory contains functions and templates for sending emails to admins and users alike. See the documentation on creating templates [email-templating](/docs/email-templating.md).

To send an email, use the `sendServiceMail` function exported in `email/sendMail.js`. This function automatically uses the correct authentication.

## `query/`

## `queryHandler/`

Contains modules that define requests to on prem servers and the cluster, along with some relevant library functions.
- `getPool.js` exports a function that resolves a pool by name, with reasonable defaults; used by the router to resolve pool connection to desired target
-


## `router/`

The distributed data router. Parses incoming queries, detemines which tables are visited, determines which databases contain those tables, and provides a list of viable database targets to the caller.

- `queryToDatabaseTarget.js`

See technical notes on the router [data-router.md](/docs/data-router.md).


---

## `cacheAsync.js`

Generalizes the ability to cache the result of async functions (almost always requests to the database).

## `constants.js`

An ideal location to store constant values.

## `CustomTransformStream.js`

## `dateUtils.js`

## `debugTimer.js`

## `directQuery.js`

## `Dropbox.js`

## `DrobpobVault.js`

## `emailAuth.js`

## `exponentialBackoff.js`

## `googleServiceAccountKeyFile.json`

This file should exist, but it should never be committed to source control.

It can be moved so long as the reference to its path is updated in the module(s) where a google api client is generated with this authorization strategy, for example in `serviceAccountAuth.js`.

## `guestTokenHashFromRequest.js`

## `nodeCache.js`

Exports a wrapper around an in-memory cache. When adding cache keys, consider the cache defaults carefully.

Used by `cacheAsync.js`, which generalizes caching request responses.

## `oAuth.js`

## `objectUtils.js`

## `prepareOnPremQuery.js`

## `preWarmCacheAsync.js`

## `readJSON.js`

## `safePromise.js`

## `sanctuary.js`

## `serviceAccountAuth.js`

## `sqlSegments.js`

# sanctuary

Initialize the sanctuary instance. Applies types for fluture. Turns off run-time type checking in production.

# cacheAsync

A function which handles the caching of the result of a provided async function and a cache key. Note the required function signature.
