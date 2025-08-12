# Database

The on prem servers run SQL Server and accept the TSQL flavor of SQL (as opposed to the Databricks cluster which accepts ANSI SQL).

A connection to them is created upon startup using the `mssql` package: https://github.com/tediousjs/node-mssql , fixed at major version 8.

## Config

Connections are configured in `/config/dbConfig` with separate connections for each server, and separate connections for read and write.

## Pool Connection

Pool connections are created and exported for use in `/dbHandlers/dbPools.js`. Connections are exported as both Promises and Futures.
