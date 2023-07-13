const initLogger = require('../../log-service');
const log = initLogger ('utility/coerce-to-iso');

const coerceToISO = (dateString) => {
  if (typeof dateString !== 'string') {
    log.warn('incorrect type: expecting string representation of date', { dateString });
    return null;
  }

  if (dateString.length !== 24) {
    log.warn ('expected date string to be 24 characters long', { dateString });
    return dateString;
  }

  // replace colons with dashes in the date segment of the date string
  let date = dateString.slice(0, 10).replace(/:/g, '-');
  let tail = dateString.slice(10);

  if (dateString.slice(0,10) !== date) {
    log.warn ('attempted to correct non-ISO date string', {
      received: dateString,
      returned: date + tail,
    });
  }

  return date + tail;
};

module.exports = { coerceToISO };
