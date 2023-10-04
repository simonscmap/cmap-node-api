# Distributed Datasets Router

Refer to the spec for distributed data: [CAMP-582](https://simonscmap.atlassian.net/browse/CMAP-582)

Some CAMP datasets are too large to reasonably store on-prem and are therefore stored in a distributed fashion. Consequently some queries will only work on specific servers. Moreover, queries which visit multiple tables may not be serviceable, if the tables specified do not reside on the same server.

The on-prem servers are named `rainier`, `rossby`, and `mariana`. The initial sparq cluster is named `cluster`. These are the names (strings) used to identify servers system wide.

The Distributed Datasets Router manages incoming queries on the `api/data/query` route (also the "custom query route"), detecting which datasets an incoming query will visit and routes the query to a valid database.

Additional functionality has been added to complement the routing feature: (1) select * expansion, (2) query size checking, and (3) automatic retries. Select * expansion detects `select *` queries and converts the asterix into a named list of all columns; this allows for datasets with many variables to be stored in column sets. Query size checking evaluates incoming querise to ensure that they do not match more than 2 million rows; it will disallow queries that exceed that limit. Automatic retries are made in the event a query fails, as long as there remain untried candidate servers.

## Phases of the Query Route as Middleware

The steps to implement data routing (and complementary features) on the `api/data/query` route have been separated into 5 pieces of middleware.

| Step | Description | Function |
| --- | --- | --- |
| 1 | modifications are made to the query | [/controllers/data/index.js::queryModification](/controllers/data/index.js) |
| 2 | the modified query is analyzed | [/middleware/queryAnalysis.js](/middleware/queryAnalysis.js) |
| 3 | candidate servers are calculated | [/utility/router/routerMiddleware.js](/utility/router/routerMiddleware.js) |
| 4 | the size of the query is derived | [/middleware/checkQuerySize.js](/middleware/checkQuerySize.js) |
| 5 | the query is executed | [/utility/router/router.js::routeQueryFromMiddleware](/utility/router/router.js) |

1. The incoming query is checked to see if it is executing a registered stored procedure, and if so that sproc is called with a flag that causes it to return an executable query string (which can be analyzed in a later step to determine which server to execute it on). The "select *" expansion function is then applied, and the final modified query is placed on the request obejct and passed to the next middleware function.

2. The modified query is parsed; named tables are extracted and analyzed to determine if they are core tables or dataset tables. The results are placed on the request object for further use by other middleware.

3. The extracted tables used to calculate candidate servers that are capable of executing the query. The result is placed on the request object.

4. The modified query, along with the extracted table names, are used to derive the row count of query, ether by querying the appropriate database for a count or by calculating the result from the spatiotemporal constraints if the dataset is gridded. If the query is too large, an error response is sent and remaining middleware is bypassed.

5. The query is executed: the list of candidate servers is already provided, and now the modified query is passed to the appropriate handler. If the query fails, and there are alternate servers, each server is tried in succession until the list is exhausted.

## Middleware vs `queryHandler`

The `api/data/query` route uses the middleware approach to clarify the different steps of handling an incoming query. Specifically, it uses `routeQueryFromMiddleware` function, which assumes that the query has been analyzed and candidate servers already identified.

Other routes employ the `queryHandler` function, which implements the data routing features described above, given a query string.


## Tracing the path of the request through the router

Here is a synoptic view of the sequence of function calls that make up the router.

### Preparation

- When a route controller delegates to the `queryHandler` in engages the router; the entry point is [/queryHandler/index.js](/utility/queryHandler/index.js) which calls [/router/router.js::routeQuery](/utility/router/router.js).
- The `routeQuery` function calls [/router/queryToDatabaseTarget::getCandidateList](/utility/router/queryToDatabaseTarget.js), in order to determine which server to target, and then delegates the execution of the query and handling of the response to either [/queryHandler/queryOnPrem.js](/utility/queryHandler/queryOnPrem.js) or [/queryHandler/queryCluster.js](/utility/queryHandler/queryCluster.js) based on whether `getCandidateList` determined that the query should be run on-prem or on a cluster node.
- `getCandidateList` contains the core function of the router, which includes analyzing the query to identify which datasets are requested, determining where those datasets are available, and calculating a viable server that has all required datasets.

### Execution

- Once the list of candidates has been calculated, the router executes the query. This is the point where the `routeQueryFromMiddleware` and the `routeQuery` function converge. They both delegate execution (via a function named `delegateExecution`) to the appropriate handler, either for an on-prem request or a request to the cluster. The `delegateExecution` function received the result of the query handler; if a retry is available, it calls itself with an updated list of candidate servers.

## Implementation details

### Round Robin

The [round robin](/utility/router/roundRobin.js) is used to determine which server to direct the query to when multiple on-prem servers are valid targets. The round robin is called by `getPool` within `queryOnPrem`. It does not yet apply to cluster queries.

The round robin function takes a list of viable server names, generates a random index based on the length of the list, and then returns the value at that index of the list.

Note, if no list is provided, it will default to an empty list, and will return undefined.

The calling function `getPool` accomodates this `undefined` return by defaulting (via `mapServerNameToPoolConnection` in [roundRobin.js](/utility/router/roundRobin.js)) to `rainier`.

### Automatic Retry on Ranier

`executeQueryOnPrem` uses an automatic retry on `rainier` if the query fails on a server other than ranier, and if the query can be rerun on `rainier`.

### Respecting `servername` query arg

A query parameter `servername` can be used to specify which server to run the query on. If this argument exists, the router does not try to run the query elsewhere. However, the router will return an error and decline to run the query if the provided server is not a valid target for the query.

### Query-to-Database-Target

The `queryToDatabaseTarget` module exports a single function `getCandidateList`, which takes as its only parameter the query in question, and returns an object describing the resulting set of viable database targets. The object includes:
- `commandType`: a string indicating whether the query is a sproc or a custom query (`sproc` | `custom`)
- `priorityTargetType`: a string indicating whether the query should run on-prem or on cluster (`cluster` | `prem`)
- `candidateLocations`: the array of viable server names (e.g. `["ranier", "cluster]`)
- `errorMessage`: in cases where a detailed error message is needed

`queryToDatabaseTarget` proceeds in 8 distinct steps, which are commented clearly in the module itself:
1. parse the query and extract the names of the tables that will be visited by the query
2. fetch a list of all tables in the database (cached)
3. filter the table names extracted from the query, remove and table names that do not exist
4. fetch an index of dataset ids
5. fetch an index of dataset locations (map dataset id to server name)
6. calculate valid servers for the set of tables that must be visited to run the query
7. apply prioritization (on-prem before cluster)
8. determine if a detailed error message is necessary
9. return result (as specified above)

### EXEC queries versus Custom Queries and the Extraction of Table Names

The first analytical job the `getCandidateList` function must perform is the extraction of the names of the tables that will be visited by the query (see [extractTableNamesFromQuery](/utility/router/pure.js). But, the approach varies based on the type of query. The module accommodates two exclusive and exhaustive categories: the query is either executing a sproc (stored procedure) with an `EXEC` command, or it is executing a custom query, such as a `SELECT`.

1. if it is an `EXEC`: the table names (if any) in the `EXEC` query are extracted with custom string parsing
2. otherwise: the query is parsed with a query parser [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser), and table names are yielded by the resulting `AST`.

Note that the `AST` will include the names of the result of joins, so further filtering is applied to only accept table names that begin with `tbl`. This is a fundamental assumption of the router.

Note also that some sprocs do not take any table names as parameters, and therefore no table names are extricable from the query string. For example, `uspDatasetsWithAncillary`. For this reason, queries are allowed to continue if no table names are extracted AND the query is an `EXEC`. In these cases, the query will be run on the default pool, which targets the `rainier` server.

Note finally that the router must accomodate both the Transact SQL and Hive SQL flavors of query syntax. Therefore in the `queryToAST` helper it first tries to provide an AST by parsing the query as `transactsql`, and if it fails it will try again as `hive`. The type of query syntax has been added to logs, to assist in debugging.

### Generating the Candidate List

The logic determining which database names to return as candidate targets for the given query is the function `calculateCandidateTargets` in [queryToDatabaseTarget.js](/utility/queryToDatabaseTarget.js). This is the synchronous function called by the main function once all the asynchronous data is fetched; this allows for the core logic to be tested more easily. See "testing" below.

`calculateCandidateTargets` takes:

1. the array of table names extracted from the query,
2. the array of datasets-to-id records, and
3. a Map of dasatest locations which is keyed by dataset id

and returns an the array of viable server names.

Note, this function does not throw an error if no common denominator server can be found; it will just return an empty list. However, the `queryHandler` will, under certain conditions, send the user a 400 if no candidate servers can be identified.

### Cache

The 3 fetches made within `getCandidateList` are all cached. The fetches and their caching behavior are specified in [/utility/router/queries.js](/utility/router/queries.js).

In order to determine which servers are valid targets, the router must first consult the `tblDataset_Servers` table, which maps dataset ids to the names of servers that host the dataset. But in order to make sense of this mapping, it must also be able to map the names of the tables that were extracted from the query to dataset ids. This map is derived from the `tblVariables` table.

Additionally, a fetch is made to retrieve the full set of table names on the server, which is used to filter out any tables named in queries that do not exist.

All of these calls are cached using [cacheAsync.js](/utility/cacheAsync.js). Currently the [node-cache](https://github.com/node-cache/node-cache) is configured such that keys never expire. Note also that the api does not proactively fetch these two tables during its bootstrap; instead the cache is generated on the first call to the query Handler. If a successful fetch is not yet cached, a failed request will not be cached, but will result in that particular request failing. The fetch will be attempted next request cycle.

## Code Organization

Modules pertaining to the router can be found in `/utility/queryHandler/` ande `/utility/router`;

`queryHandler/` contains the entry point, called by route controllers, as well as the implementation of the calls to the on-prem or cluster node, and the subsequent streaming of the response data (`AccumulatorStream.js`), and helpers for getting the correct pool connection (`getPool.js`).

`router/` contains both the main `getCandidateList` function which orchestrates the logical steps to determine the candidate list, including querying the database for information about table locations, and a slough of helper functions that break down the work into the smallest possible logical parts. Most of these are contained in [pure.js](/utility/router/pure.js), which denotes that none of the functions implement side effects (such as making fetches or providing responses). Also in `router/` are the implementations for the `roundRobin` and the internal queries for table information.

## Server Names

A set of strings representing the available servers is stored in [constants.js](/utility/constants.js). This must be manually updated if any additional servers are added.

## Error Responses

A 400 error is returned if no candidate servers are identified (this will not trigger if the query uses EXEC, as some sprocs do not take table names as arguments).

A 400 error is returned if the caller passes a `servername` argument which cannot be matched to any available server.

A 500 is returned if an error is encountered during query execution.

We want to provide useful error messages: if a query is submitted which cannot be executed because we could not resolve a viable server, the user may still be able to perform the analysis by downloading the datasets separately; in this case we provide a descriptive error message without naming specific servers or tables. This case is indentified when more than one table is named in a query, but no candidate servers are identified.

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

When data is fetched from `tblDataset_Servers` it comes back in record format, with one row matching a dataset id to one server; therefore, many rows are used to describe the available servers for a dataset. This record-set is transformed into a Map, and stored via `node-cache` (wrapped by [/utility/nodeCache.js](/utility/nodeCache.js)) as a [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). This test tests the correct transformation from record-set to Map.

As noted in inline comments in [queryToDatabaseTarget.js](/utility/router/queryToDatabaseTarget.js), a Map data structure was chosen over an Object because Maps are optimized for frequent read/writes (even though this map will only be written once), and Maps allow numbers to be used as keys. This lookup should be as performant as possible, since it is made before executing every query.

### calculateCandidateTargets

Three cases are split into three different tests in order to ensure the expected behavior of `calculateCandidateTargets`.
1. case where a only a single server is a candidate
2. case where multiple candidates are available
3. case where no common candidates are available

## Manual Testing

A set of curl commands have been recorded to assist with manual testing in `/test/sql/manual-tests-distributed-router.org`
