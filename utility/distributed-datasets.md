# Distributed Datasets Router

Refer to the spec for distributed data: [CMAP-582](https://simonscmap.atlassian.net/browse/CMAP-582)

Some CAMP datasets are too large to reasonably store on-Perm and are therefore stored in a distributed fashion. Consequently some queries will only work on specific servers.

The on-prem servers are `rainier`, `rossby`, and `mariana`. The initial sparq cluster is names `cluster`. These are the names (strings) used to identify servers systemwide.

The Distributed Datasets Router detects which datasets an incoming query will visit and routes the query to a valid database.

How is this implemented here in this codebase?

## Query Handler

All custom queries and several internal queries are routed through the [query Handler.J's](/utility/queryHandler.js) module, which:
- uses a [round Robin.J's](/utility/roundRobin.js) to determine which server to direct the query to
- uses an automatic retry if the query fails and there is another valid database to run the query on
- respects a `server name` prop in the query arguments, which allows the caller to specify which server to run the query on

With the advent of distributed data, the query handler now also:
- analyzes the incoming query in order to determine the set of valid databases; via [queryTodatabaseTarget.js](/utility/queryToDatabaseTarget.js).
- if the query can run on both on-prem and on a cluster, priority is given to on-prem
- if the query is determined to run on-prem, the round-robin is applied to the set of avalilable database targets

## Query-to-Database-Target

The `queryToDatabaseTarget` module takes as its only parameter the query in question, and returns a set of viable database targets--as an `Array` of database names.

### EXEC queries versus Custom Queries

Internally, the function follows two initial code-paths, based on whether it determines if the query is executing a sproc with an `EXEC` command.

1. if it is an `EXEC`: the table names (if any) in the `EXEC` query are extracted with custom string parsing
2. otherwise: the query is parsed with a query parser [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser), and table names are yielded by the resulting `AST`.

Note that the `AST` will include the names of the result of joins, so further filtering is applied to onle accept table names that begin with `tbl`. This is a fundamental assumption of the router.

Note alse that some sprocs do not take any table names as parameters, and therefore no table names are extractable from the query string. For example, `uspDatasetsWithAncillary`. For this reason, queries are allowed to continue if no table names are extracted AND the query is an `EXEC`. In these cases, the query will be run on the default pool, which targets the `rainier` server.

Either code path will yield a list of tables the query will visit.

See `mapServerNameToPoolConnection` in [roundRobin.js](/utility/roundRobin.js).

### Cache

After the list of table names is extracted from the query, the main `getCandidateList` function in [queryToDatabaseTarget.js](/utility/queryToDatabaseTarget.js) makes two async fetches; both are cached.

In order to determine which servers are valid targets, the main function must first consult the `tblDataset_Servers` table, which maps dataset ids to the names of servers that host the dataset. But in order to make sense of this mapping, it must also be able to map the names of the tables that were extracted from the query to dataset ids. This map is derrived from the `tblVariables` table.

Both of these calls are cached using [cacheAsync.js](/utility/cacheAsync.js). Currently the [node-cache](https://github.com/node-cache/node-cache) is configured such that keys never expire. Note also that the api does not proactively fetch these two tables during its bootstrap; instead the cache is generated on the first call to the query Handler.

### Generating the Candidate List

The logic determining which database names to return as candidate targets for the given query is the function `calculateCandidateTargets` in [queryToDatabaseTarget.js](/utility/queryToDatabaseTarget.js). This is the synchronous function called by the main function once all the asynchronous data is fetched; this allows for the core logic to be tested more easily. See "testing" below.

`calculateCandidateTargets` takes:

1. the array of table names extracted from the query,
2. the array of datasets-to-id records, and
3. a Map of dasatest locations which is keyed by dataset id

and returns an the array of viable server names.

Note, this function does not throw an error if no common denominator server can be found; it will just return an empty list. However, the `queryHandler` will, under certain conditions, send the user a 400 if no candidate servers can be identified.

## Server Names

A set strings representing the available servers is stored in [constants.js](/utility/constants.js). This must be manually updated if any additional servers are added.

## Round Robin & default to rainier

The round robin behavior alternates randomly across viable server targets on a per-query basis. This is realized by a simple function that takes a list, generates a random index based on the length of the list, and then returns the value at that index of the list.

Note, if no list is provided, it will default to an empty list, and will return undefined.

The caller, `queryHandler` works with this behavior by depending on the default behavior of `mapServerNameToPoolConnection`, in [roundRobin.js](/utility/roundRobin.js), which will default to `rainier`.

See implementation: [roundRobin.js](/utility/roundRobin.js)

## Error Responses

A 400 error is returned if no candidate servers are identified (this will not trigger if the query uses EXEC, as some sprocs do not take table names as arguments).

A 400 error is returned if the caller passes a `servername` argument which cannot be matched to any available server.

A 500 is returned if an error is encountered during query execution.

## Tests

Tests for the router can be found in [/test/sql/distributed-datasets.js](/test/sql/distributed-datasets.js). The tests each target a separate piece of work that the `queryToDatabaseTarget` initiates.

Fixtures are stored in [/test/fixtures/sample-queries.js](/test/fixtures/sample-queries.js) and are stored with their expected output. As any additional query types or edge cases are identified, test queries representing those cases should be added to the fixtures module, and they will automatically be run by the "extractTableNamesFromQuery" test.

### extractTableNamesFromQuery

This test uses fixtures to check that the correct list of table names is extracted from a variety of queries, ranging from simple to complex queries, from `CTE`s to `EXEC` to custom queries with joins. These are all stored as fixtures.

### extractTableNamesFromAst

This test specifically checks the functionality of the [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser) library (this function is called by `extractTableNamesFromQuery`, and so a wider range of queries is tested there). This test also check the behavior of passing an empty query to the parser.

### removeSQLBlockComments, isSproc

In order to determine if a query is an `EXEC`, any comments must first be removed. Comments can be dashed `-- ...` or block `/* ... */`. The `isSproc` test calls the `isSproc` function, which in turn calls both `removeSQLBlockComments` and `removeSQLDashComments`.

### transformDatasetServersListToMap

When data is fetched from `tblDataset_Servers` it comes back in record format, with one row matchin a dataset id to one server; therefore, many rows are used to describe the available servers for a dataset. This recordset is transformed into a Map, and stored via `node-cache` (wrapped by [/utility/nodeCache.js](/utility/nodeCache.js)) as a [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). This test tests the correct transformation from recordset to Map.

As noted in inline comments in [queryToDatabaseTarget.js](/utility/queryToDatabaseTarget.js), a Map datastructure was chosed over an Object because Maps are optimized for frequent read/writes (even though this map will only be written once), and Maps allow numbers to be used as keys. This lookup should be as performant as possible, since it is made before executing every query.

### calculateCandidateTargets

Three cases are split into three different tests in order to ensure the expected behavior of `calculateCandidateTargets`.
1. case where a only a single server is a candidate
2. case where multiple candidates are available
3. case where no common candidates are available