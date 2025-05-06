// Correct for a certain non-ISO format that sometimes crops up on the server
const coerceToISO = (dateString, log) => {
  if (typeof dateString !== 'string') {
    log.warn('incorrect type: expecting string representation of date', {
      dateString,
    });
    return null;
  }

  if (dateString.length !== 24) {
    log.warn('expected date string to be 24 characters long', { dateString });
    return dateString;
  }

  // replace colons with dashes in the date segment of the date string
  let date = dateString.slice(0, 10).replace(/:/g, '-');
  let tail = dateString.slice(10);

  if (dateString.slice(0, 10) !== date) {
    log.warn('attempted to correct non-ISO date string', {
      received: dateString,
      returned: date + tail,
    });
  }

  return date + tail;
};

const coerceTimeMinAndMax = (metadataObject, log) => {
  let data = Object.assign({}, metadataObject);
  if (data.Time_Max) {
    data.Time_Max = coerceToISO(data.Time_Max, log);
  }
  if (data.Time_Min) {
    data.Time_Min = coerceToISO(data.Time_Min, log);
  }
  return data;
};

module.exports = { coerceToISO, coerceTimeMinAndMax };
