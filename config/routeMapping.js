// Maps request path to a route ID used in recording calls to SQL. No longer maintained

let routeMapping = {
  // A route ID of 1 in SQL means no matching route was found
  '': 2,
  // 1xx for catalog
  '/catalog': 101,
  '/api/catalog': 101,

  // 2xx for users
  '/user/signup': 201,
  '/user/signin': 202,
  '/user/validate': 203,
  '/user/signout': 204,
  '/user/generateapikey': 205,

  '/api/user/signup': 201,
  '/api/user/signin': 202,
  '/api/user/validate': 203,
  '/api/user/signout': 204,
  '/api/user/generateapikey': 205,

  // 3xx for dataretrieval
  '/dataretrieval/query': 301,
  '/dataretrieval/sp': 302,
  '/dataretrieval/tablestats': 303,

  '/api/dataretrieval/query': 301,
  '/api/dataretrieval/sp': 302,
  '/api/dataretrieval/tablestats': 303,

  // 4xx for data operations
  '/api/data/dropbox-vault/download-files': 401,
};

module.exports = (path) => {
  // Convert to lower case, remove trailing slash if found and map path to route ID
  path = path.toLowerCase();
  while (path[path.length - 1] === '/') path = path.slice(0, -1);
  return routeMapping[path] || 1;
};
