//

module.exports = class GuestUser {
  constructor() {
    this.firstName = 'Guest';
    this.lastName = 'Guest';
    this.username = 'Guest';
    this.password = 'NoPass';
    this.email = 'Guest';
    this.institute = null;
    this.department = null;
    this.country = null;

    this.googleID = null;

    this.id = null;

    this.apiKey = null;
    this.apiKeyID = null;
    this.isDataSubmissionAdmin = false;
  }
};
