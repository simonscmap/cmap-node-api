# Endpoint Tester

Quick tool for testing API endpoints without spinning up the frontend.

## Usage

```bash
# Test public endpoints
node test-endpoints.js GET /api/catalog/datasets

# Test with authentication
node test-endpoints.js GET /api/user/profile myuser mypass

# Test POST requests
node test-endpoints.js POST /api/user/signin '{"username":"test","password":"test"}'
```

## Common Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/api/catalog` | Full catalog (CSV) | No |
| GET | `/api/catalog/cruisefullpage` | Cruise details | No |
| GET | `/api/news/list` | News items | No |
| GET | `/api/user/profile` | User profile | Yes |
| POST | `/api/user/signin` | Login | No |
| GET | `/api/data` | Data queries | Maybe |

## Examples

```bash
# Quick catalog check (returns CSV data)
node test-endpoints.js GET /api/catalog

# News items
node test-endpoints.js GET /api/news/list

# Login test
node test-endpoints.js POST /api/user/signin '{"username":"your_user","password":"your_pass"}'

# Authenticated request
node test-endpoints.js GET /api/user/profile your_user your_pass
```