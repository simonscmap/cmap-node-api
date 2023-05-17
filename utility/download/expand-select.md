# Expand Select Star

Some datasets with large sets of variables are stored in the on-prem database with column sets.

This runs afoul of the clients' practice of submitting queries with "select * from ...".

To accomodate this, the /api/data/custom route controller now invokes a code branch that will check the incoming query and alter it, if appropriate, by replacing the star "*" with a literal expression of all columns. It makes this alteration to the query before handing it off to the `queryHandler` and the data router.

Queries that use the uspAddAncillary are handled in the stored procedure.

## Technicalities

- In order to replace a star with an expression of all columns, a query must be made against `INFORMATION_SCHEMA.COLUMNS`. But in order to successfully make such a query, a candidate server that hosts the table must be identified. Thus a similary process to the data routes must be invoked.
- Note the use of node cache, which is set to 6 hours; note that it uses similar calls as the router will use once `queryHandler` is invoked. The cache makes the subsequent repetition of queries trivial.
- Note the criteria a query must meet to have its select statement altered:
  - it must NOT be an EXEC
  - it must match a regex identifying it as having the form "select * from"
  - it must NOT match a regex identifying it as having a join clause
