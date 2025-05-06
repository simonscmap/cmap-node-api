const { routeQuery } = require('../router/router');

/* Data handler used to route, execute, and stream queries and their responses.
 *   - uses the distributed data router in /utility/router/router.js
       to determine which server to target based on the data requested
     - uses round-robin to distribute requests over candidate server targets
     - uses execution functions to handle queries to onPrem or Cluster nodes
     - streams responses
     - see utility/distributed-data.md
 */

module.exports = routeQuery;
