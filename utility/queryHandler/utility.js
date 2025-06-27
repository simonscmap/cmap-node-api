// formateDate
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
// UTC & simplified ISO 8601
const formatDate = (date) => {
  return date.toISOString();
};

// Utility function to extract table name from SQL query
const extractTableName = (query) => {
  const match = query.match(/\bfrom\s+(\[?tbl\w+\]?)/i);
  return match ? match[1].replace(/\[|\]/g, '') : 'unknown';
};

module.exports = {
  formatDate,
  extractTableName,
};
