// Not currently in use

module.exports = class StoredProcedureArgumentSet {
  constructor(sprocArgs) {
    this.spName = sprocArgs.spName;
    this.tableName = sprocArgs.tableName;
    this.fields = sprocArgs.fields;
    this.dt1 = sprocArgs.dt1;
    this.dt2 = sprocArgs.dt2;
    this.lat1 = sprocArgs.lat1;
    this.lat2 = sprocArgs.lat2;
    this.lon1 = sprocArgs.lon1;
    this.lon2 = sprocArgs.lon2;
    this.depth1 = sprocArgs.depth1;
    this.depth2 = sprocArgs.depth2;
  }

  // Returns false if any properties are missing. Should perform a more
  // detailed validation in future versions.
  isValid() {
    return !Object.getOwnPropertyNames(this).some((property) => {
      return !this[property];
    });
  }
};
