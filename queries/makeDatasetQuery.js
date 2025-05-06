// new dataset object
// does not include dataset variables, or UM

const makeDatasetQuery = (id) => {
  return `
    select * from tblDatasets where ID = ${id}
  `;
};

module.exports = {
  makeDatasetQuery,
};
