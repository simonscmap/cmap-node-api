# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SimonsCMAPAPI is the Node.js API layer supporting Simons CMAP Web App and SDKs. It provides scientific data access through a distributed database architecture with intelligent query routing.

## Common Development Commands

### Setup and Development

```bash
# Install dependencies
npm install

# Start development server (requires nodemon)
npm run dev

# Start production server (uses PM2)
npm start
```

### Testing

```bash
# Run all tests
npm test



### Deployment
```bash
# Deploy to production (builds both frontend and API)
./deploy.sh

# Archives are created in parent directory under /deployments
```

## Architecture Overview

### Core Technologies

- **Framework**: Express.js with middleware pattern
- **Authentication**: Passport.js with JWT, API keys, and Google OAuth
- **Database**: MS SQL Server with connection pooling
- **Functional Programming**: Fluture and Sanctuary for async operations
- **Testing**: AVA framework

### Key Architectural Patterns

1. **Distributed Database Router**
   - Queries are analyzed and routed to appropriate database servers (Rainier, Rossby, Mariana, or Cluster)
   - Routing logic in `/controllers/data/retrieval/query/queryHandler.js`
   - Connection pooling configured per server

2. **Authentication Flow**
   - Multiple strategies: JWT (`/auth/tokenAuthStrategies.js`), API Keys (`/auth/headerKeys.js`), Google OAuth
   - Session-less authentication
   - User context attached to req.user

3. **Data Streaming**
   - Large datasets use stream-based processing
   - Transform streams for data formatting
   - Temporary file management for bulk downloads

4. **Functional Programming Approach**
   - Heavy use of Fluture for async operations
   - Chain and compose patterns throughout
   - Error handling via Either types

### Project Structure

```
/routes         - Express route definitions
/controllers    - Business logic organized by domain
  /catalog      - Dataset catalog operations
  /data         - Data retrieval and transformations
  /user         - User management
  /news         - Content management
/dbHandlers     - Database connection and query execution
/utility        - Shared utilities and services
/middleware     - Express middleware functions
/auth           - Authentication strategies
/test           - AVA test files
```

### Critical Files and Their Purposes

- `app.js` - Main application entry point
- `/routes/api.js` - Primary API router
- `/controllers/data/retrieval/query/queryHandler.js` - Core query routing logic
- `/utility/router/distributeQuery.js` - Distributed query execution
- `/dbHandlers/mssql.js` - Database connection pooling
- `/utility/caching/cacheKeys.js` - Cache key generation
- `/auth/storeApiCall.js` - API usage tracking

### Database Configuration

Database connections are configured per environment with these servers:

- **Rainier**: Primary production server
- **Rossby**: Secondary server
- **Mariana**: Specialized datasets
- **Cluster**: Databricks cluster for large-scale queries

Connection strings use environment variables prefixed with server names.

### Key Development Considerations

1. **Query Routing**: When working with data queries, understand that routing depends on dataset location. Check `/utility/router/chooseServer.js` for routing logic.

2. **Caching Strategy**: Uses node-cache with specific TTLs per data type. Cache keys are generated based on query parameters.

3. **Error Handling**: Fluture chains handle errors functionally. Use `.chainRej()` for error transformations.

4. **API Usage Tracking**: All API calls are logged with user context for usage metrics.

5. **Data Formats**: Supports JSON, CSV, and custom formats. Format transformations in `/controllers/data/retrieval/transforms/`.

6. **File Storage**: Uses Dropbox for user-submitted files and temporary download storage.

### Other Rules

- Do not use optional chaining (?.) — it is not supported in Node.js v12. Use traditional null checks instead.
