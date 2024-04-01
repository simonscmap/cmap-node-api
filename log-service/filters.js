const removeApiCallDetailLogs = (log) =>
  log.message !== 'api call detail';


const allDevelopmentFilters = [
  removeApiCallDetailLogs,
];

const filterLogsForDevelopment = (log) => {
  const filterResults = allDevelopmentFilters.map ((fn) => fn (log));
  return filterResults.every (result => result); // all filters must return true
};

module.exports = filterLogsForDevelopment;
